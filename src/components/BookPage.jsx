import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const BookPage = () => {
  const location = useLocation();
  const qa = location.state?.qa || {};
  const [chapters, setChapters] = useState([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState(null);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    fetchAndStreamChapters();
  }, [qa]);
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current
        .play()
        .catch((e) => console.error("Audio playback failed:", e));
    }
  }, [audioUrl]);

  const fetchAndStreamChapters = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/stream_chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(qa),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              setIsProcessing(false);
              break;
            }
            updateChapters(data);
          }
        }
      }
    } catch (error) {
      console.error("Streaming error:", error);
      setError(
        "An error occurred while processing your personalized chapters. Please try again."
      );
      setIsProcessing(false);
    }
  };

  const updateChapters = (data) => {
    setChapters((prevChapters) => {
      const chapterIndex = prevChapters.findIndex(
        (ch) => ch.name === data.name
      );
      if (chapterIndex === -1) {
        return [...prevChapters, { ...data, chunks: [], audio_urls: [] }];
      } else {
        const updatedChapters = [...prevChapters];
        const chapter = updatedChapters[chapterIndex];

        if (data.content) {
          chapter.chunks = [...(chapter.chunks || []), data.content];
        }
        if (data.audio_url) {
          chapter.audio_urls = [...(chapter.audio_urls || []), data.audio_url];
        }

        chapter.parts = (chapter.parts || 0) + 1;
        chapter.total_parts = data.total_parts;

        return updatedChapters;
      }
    });

    // Update audio URL when a new chunk is received
    if (data.audio_url) {
      setAudioUrl(data.audio_url);
    }
  };

  const handlePrevious = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentChapterIndex < chapters.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
    }
  };

  const handleAskQuestion = async () => {
    await fetch("http://127.0.0.1:5000/stop_streaming", {
      method: "POST",
    });
    setIsQuestionModalOpen(true);
  };

  const handleCloseQuestionModal = () => {
    setIsQuestionModalOpen(false);
    setQuestion("");
    setAnswer("");
    fetchAndStreamChapters();
  };

  const handleSubmitQuestion = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/ask_question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAnswer(data.answer);
    } catch (error) {
      console.error("Error asking question:", error);
      setAnswer(
        "An error occurred while processing your question. Please try again."
      );
    }
  };

  const handleAddInfo = async () => {
    await fetch("http://127.0.0.1:5000/stop_streaming", {
      method: "POST",
    });
    setIsInfoModalOpen(true);
  };

  const handleCloseInfoModal = async () => {
    setIsInfoModalOpen(false);
    try {
      await fetch("http://127.0.0.1:5000/addinfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalInfo }),
      });
      setAdditionalInfo("");
      fetchAndStreamChapters();
    } catch (error) {
      console.error("Error adding info:", error);
      setError(
        "An error occurred while adding your information. Please try again."
      );
    }
  };

  const renderChapterContent = () => {
    const chapter = chapters[currentChapterIndex];
    if (!chapter) return null;

    const progress = (chapter.parts / chapter.total_parts) * 100;
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-4">{chapter.name}</h2>
        {isProcessing && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Processing: {Math.round(progress)}%
            </p>
          </div>
        )}
        <div className="mb-6 whitespace-pre-wrap">
          {chapter.chunks.join("\n\n")}
        </div>
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Audio Version:</h3>
          <audio ref={audioRef} controls className="w-full">
            Your browser does not support the audio element.
          </audio>
        </div>
        {/* / */}
      </div>
    );
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }
  }, [currentChapterIndex]);

  if (error) {
    return <div className="text-center py-8 text-red-500">{error}</div>;
  }

  const AudioPlayer = ({ audioUrl }) => {
    const audioRef = useRef(null);

    useEffect(() => {
      if (audioUrl && audioRef.current) {
        // Construct the full URL to the audio file
        const fullAudioUrl = `http://localhost:5000${audioUrl}`;
        audioRef.current.src = fullAudioUrl;
        audioRef.current.load();
      }
    }, [audioUrl]);

    return (
      <audio ref={audioRef} controls>
        Your browser does not support the audio element.
      </audio>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        12 Rules of Life - Personalized Chapters
      </h1>

      {/* Question Modal */}
      {chapters[currentChapterIndex]?.audio_urls.map((url, index) => (
        <AudioPlayer key={index} audioUrl={url} />
      ))}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Ask a Question
              </h3>
              <div className="mt-2 px-7 py-3">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  placeholder="Type your question here"
                />
                {answer && (
                  <div className="mt-4 text-sm text-gray-500">
                    <strong>Answer:</strong> {answer}
                  </div>
                )}
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={handleSubmitQuestion}
                  className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  Submit Question
                </button>
                <button
                  onClick={handleCloseQuestionModal}
                  className="mt-3 px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Add More Information
              </h3>
              <div className="mt-2 px-7 py-3">
                <textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  placeholder="Add more information about yourself here"
                  rows="4"
                />
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={handleCloseInfoModal}
                  className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  Submit Additional Info
                </button>
                <button
                  onClick={() => setIsInfoModalOpen(false)}
                  className="mt-3 px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {chapters.length > 0 ? (
        <div>
          <div className="flex justify-center space-x-4 mb-6">
            <button
              onClick={handleAskQuestion}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Ask Question
            </button>
            <button
              onClick={handleAddInfo}
              className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
            >
              Add More Info About Yourself
            </button>
          </div>
          {renderChapterContent()}
          <div className="flex justify-between mt-6">
            <button
              onClick={handlePrevious}
              disabled={currentChapterIndex === 0}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              Previous Chapter
            </button>
            <button
              onClick={handleNext}
              disabled={currentChapterIndex === chapters.length - 1}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              Next Chapter
            </button>
          </div>
        </div>
      ) : (
        <p>Processing your personalized chapters...</p>
      )}
    </div>
  );
};

export default BookPage;
// import React, { useState, useEffect, useRef } from "react";
// import { useLocation } from "react-router-dom";

// const BookPage = () => {
//   const location = useLocation();
//   const qa = location.state?.qa || {};
//   const [chapters, setChapters] = useState([]);
//   const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
//   const [isProcessing, setIsProcessing] = useState(true);
//   const [error, setError] = useState(null);
//   const [audioFiles, setAudioFiles] = useState({});
//   const [isPlaying, setIsPlaying] = useState(false);
//   const audioRef = useRef(null);
//   const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
//   const [question, setQuestion] = useState("");
//   const [answer, setAnswer] = useState("");
//   const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
//   const [additionalInfo, setAdditionalInfo] = useState("");

//   useEffect(() => {
//     const fetchAndStreamChapters = async () => {
//       try {
//         const response = await fetch("http://127.0.0.1:5000/stream_chapters", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify(qa),
//         });

//         if (!response.ok) {
//           throw new Error(`HTTP error! status: ${response.status}`);
//         }

//         const reader = response.body.getReader();
//         const decoder = new TextDecoder();

//         let buffer = "";
//         while (true) {
//           const { value, done } = await reader.read();
//           if (done) break;

//           buffer += decoder.decode(value, { stream: true });
//           const lines = buffer.split("\n\n");
//           buffer = lines.pop();

//           for (const line of lines) {
//             if (line.startsWith("data: ")) {
//               const data = JSON.parse(line.slice(6));
//               if (data.done) {
//                 setIsProcessing(false);
//                 break;
//               }
//               await updateChapterAndConvertAudio(data);
//             }
//           }
//         }
//       } catch (error) {
//         console.error("Streaming error:", error);
//         setError(
//           "An error occurred while processing your personalized chapters. Please try again."
//         );
//         setIsProcessing(false);
//       }
//     };

//     fetchAndStreamChapters();
//   }, [qa]);

//   const updateChapterAndConvertAudio = async (data) => {
//     setChapters((prevChapters) => {
//       const chapterIndex = prevChapters.findIndex(
//         (ch) => ch.name === data.name
//       );
//       if (chapterIndex === -1) {
//         const newChapter = { ...data, chunks: [data.content] };
//         convertAndStoreAudio(newChapter);
//         return [...prevChapters, newChapter];
//       } else {
//         const updatedChapters = [...prevChapters];
//         updatedChapters[chapterIndex] = {
//           ...updatedChapters[chapterIndex],
//           chunks: [
//             ...(updatedChapters[chapterIndex].chunks || []),
//             data.content,
//           ],
//           parts: (updatedChapters[chapterIndex].parts || 0) + 1,
//           total_parts: data.total_parts,
//         };
//         convertAndStoreAudio(updatedChapters[chapterIndex]);
//         return updatedChapters;
//       }
//     });
//   };

//   const convertAndStoreAudio = async (chapter) => {
//     try {
//       const response = await fetch("http://127.0.0.1:5000/convert_and_store", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           chapter_name: chapter.name,
//           text: chapter.chunks.join("\n\n"),
//         }),
//       });

//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }

//       const data = await response.json();
//       setAudioFiles((prev) => ({ ...prev, [chapter.name]: data.filename }));
//     } catch (error) {
//       console.error("Error converting and storing audio:", error);
//     }
//   };

//   const handlePlayPause = async () => {
//     const currentChapter = chapters[currentChapterIndex];
//     if (!currentChapter) return;

//     const audioFilename = audioFiles[currentChapter.name];
//     if (!audioFilename) {
//       console.error("Audio not ready yet");
//       return;
//     }

//     if (!audioRef.current.src) {
//       audioRef.current.src = `http://127.0.0.1:5000/get_audio/${audioFilename}`;
//     }

//     if (isPlaying) {
//       audioRef.current.pause();
//     } else {
//       audioRef.current.play();
//     }
//     setIsPlaying(!isPlaying);
//   };

//   const handlePrevious = () => {
//     if (currentChapterIndex > 0) {
//       setCurrentChapterIndex(currentChapterIndex - 1);
//     }
//   };

//   const handleNext = () => {
//     if (currentChapterIndex < chapters.length - 1) {
//       setCurrentChapterIndex(currentChapterIndex + 1);
//     }
//   };

//   const handleAskQuestion = async () => {
//     await fetch("http://127.0.0.1:5000/stop_streaming", {
//       method: "POST",
//     });
//     setIsQuestionModalOpen(true);
//   };

//   const handleCloseQuestionModal = async () => {
//     setIsQuestionModalOpen(false);
//     setQuestion("");
//     setAnswer("");
//     await resumeStreaming();
//   };

//   const handleSubmitQuestion = async () => {
//     try {
//       const response = await fetch("http://127.0.0.1:5000/ask_question", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ question }),
//       });

//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }

//       const data = await response.json();
//       setAnswer(data.answer);
//     } catch (error) {
//       console.error("Error asking question:", error);
//       setAnswer(
//         "An error occurred while processing your question. Please try again."
//       );
//     }
//   };

//   const handleAddInfo = async () => {
//     await fetch("http://127.0.0.1:5000/stop_streaming", {
//       method: "POST",
//     });
//     setIsInfoModalOpen(true);
//   };

//   const handleCloseInfoModal = async () => {
//     setIsInfoModalOpen(false);
//     try {
//       await fetch("http://127.0.0.1:5000/addinfo", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ additionalInfo }),
//       });
//       await resumeStreaming();
//     } catch (error) {
//       console.error("Error adding additional info:", error);
//       setError(
//         "An error occurred while processing your additional information. Please try again."
//       );
//     }
//   };

//   const resumeStreaming = async () => {
//     try {
//       const response = await fetch("http://127.0.0.1:5000/stream_chapters", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(qa),
//       });

//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }

//       const reader = response.body.getReader();
//       const decoder = new TextDecoder();

//       let buffer = "";
//       while (true) {
//         const { value, done } = await reader.read();
//         if (done) break;

//         buffer += decoder.decode(value, { stream: true });
//         const lines = buffer.split("\n\n");
//         buffer = lines.pop();

//         for (const line of lines) {
//           if (line.startsWith("data: ")) {
//             const data = JSON.parse(line.slice(6));
//             if (data.done) {
//               setIsProcessing(false);
//               break;
//             }
//             await updateChapterAndConvertAudio(data);
//           }
//         }
//       }
//     } catch (error) {
//       console.error("Resuming stream error:", error);
//       setError(
//         "An error occurred while processing your personalized chapters. Please try again."
//       );
//       setIsProcessing(false);
//     }
//   };

//   const renderChapterContent = () => {
//     const chapter = chapters[currentChapterIndex];
//     if (!chapter) return null;

//     const progress = (chapter.parts / chapter.total_parts) * 100;
//     return (
//       <div>
//         <h2 className="text-2xl font-semibold mb-4">{chapter.name}</h2>
//         {isProcessing && (
//           <div className="mb-4">
//             <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
//               <div
//                 className="bg-blue-600 h-2.5 rounded-full"
//                 style={{ width: `${progress}%` }}
//               ></div>
//             </div>
//             <p className="text-sm text-gray-500 mt-1">
//               Processing: {Math.round(progress)}%
//             </p>
//           </div>
//         )}
//         <div className="mb-6 whitespace-pre-wrap">
//           {chapter.chunks.join("\n\n")}
//         </div>
//         <div className="flex justify-center space-x-4 mb-4">
//           <button
//             onClick={handlePlayPause}
//             disabled={!audioFiles[chapter.name]}
//             className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
//           >
//             {isPlaying ? "Pause" : "Play"}
//           </button>
//         </div>
//         <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
//       </div>
//     );
//   };

//   if (error) {
//     return <div className="text-center py-8 text-red-500">{error}</div>;
//   }

//   return (
//     <div className="container mx-auto px-4 py-8">
//       <h1 className="text-3xl font-bold mb-6">
//         12 Rules of Life - Personalized Chapters
//       </h1>

//       {isQuestionModalOpen && (
//         <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
//           <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
//             <div className="mt-3 text-center">
//               <h3 className="text-lg leading-6 font-medium text-gray-900">
//                 Ask a Question
//               </h3>
//               <div className="mt-2 px-7 py-3">
//                 <input
//                   type="text"
//                   value={question}
//                   onChange={(e) => setQuestion(e.target.value)}
//                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
//                   placeholder="Type your question here"
//                 />
//                 {answer && (
//                   <div className="mt-4 text-sm text-gray-500">
//                     <strong>Answer:</strong> {answer}
//                   </div>
//                 )}
//               </div>
//               <div className="items-center px-4 py-3">
//                 <button
//                   onClick={handleSubmitQuestion}
//                   className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
//                 >
//                   Submit Question
//                 </button>
//                 <button
//                   onClick={handleCloseQuestionModal}
//                   className="mt-3 px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
//                 >
//                   Close
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {isInfoModalOpen && (
//         <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
//           <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
//             <div className="mt-3 text-center">
//               <h3 className="text-lg leading-6 font-medium text-gray-900">
//                 Add More Information
//               </h3>
//               <div className="mt-2 px-7 py-3">
//                 <textarea
//                   value={additionalInfo}
//                   onChange={(e) => setAdditionalInfo(e.target.value)}
//                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
//                   placeholder="Add more information about yourself here"
//                   rows="4"
//                 />
//               </div>
//               <div className="items-center px-4 py-3">
//                 <button
//                   onClick={handleCloseInfoModal}
//                   className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
//                 >
//                   Submit Additional Info
//                 </button>
//                 <button
//                   onClick={() => setIsInfoModalOpen(false)}
//                   className="mt-3 px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {chapters.length > 0 ? (
//         <div>
//           <div className="flex justify-center space-x-4 mb-4">
//             <button
//               onClick={handleAskQuestion}
//               className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
//             >
//               Ask Question
//             </button>
//             <button
//               onClick={handleAddInfo}
//               className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
//             >
//               Add More Info About Yourself
//             </button>
//           </div>
//           {renderChapterContent()}
//           <div className="flex justify-between mb-4">
//             <button
//               onClick={handlePrevious}
//               disabled={currentChapterIndex === 0}
//               className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
//             >
//               Previous Chapter
//             </button>
//             <button
//               onClick={handleNext}
//               disabled={currentChapterIndex === chapters.length - 1}
//               className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
//             >
//               Next Chapter
//             </button>
//           </div>
//         </div>
//       ) : (
//         <p>Processing your personalized chapters...</p>
//       )}
//     </div>
//   );
// };

// export default BookPage;
