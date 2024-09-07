import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function StartPage() {
  const [messages, setMessages] = useState([
    {
      type: "question",
      content:
        "Hey there, before starting to read the book, do you want to tell me something about yourself?",
    },
  ]);
  const [userInput, setUserInput] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    console.log("StartPage component mounted");
  }, []);

  const handleInputChange = (e) => {
    setUserInput(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    setIsWaiting(true);
    setError(null);

    const updatedMessages = [
      ...messages,
      { type: "answer", content: userInput },
    ];
    setMessages(updatedMessages);
    setUserInput("");

    try {
      if (updatedMessages.length < 6) {
        const response = await fetch("http://127.0.0.1:5000/asknextquestion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answer: userInput,
            questionNumber: Math.floor(updatedMessages.length / 2),
          }),
        });
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const nextQuestion = await response.text();
        setMessages([
          ...updatedMessages,
          { type: "question", content: nextQuestion },
        ]);
      } else {
        navigate("/book", {
          state: {
            qa: {
              q1: messages[0].content,
              a1: messages[1].content,
              q2: messages[2].content,
              a2: messages[3].content,
              q3: messages[4].content,
              a3: userInput,
            },
          },
        });
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setIsWaiting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Chat about 12 Rules of Life</h1>
      <div className="mb-4 space-y-2">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`p-2 rounded ${
              message.type === "question" ? "bg-blue-100" : "bg-green-100"
            }`}
          >
            <p>
              <span className="font-bold">
                {message.type === "question" ? "AI: " : "You: "}
              </span>
              {message.content}
            </p>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={userInput}
          onChange={handleInputChange}
          placeholder="Type your answer here..."
          disabled={isWaiting}
          className="w-full p-2 border rounded"
          rows="3"
        />
        <button
          type="submit"
          disabled={isWaiting}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {isWaiting ? "Processing..." : "Send"}
        </button>
      </form>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
