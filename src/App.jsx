import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import StartPage from "./components/StartPage";

import BookPage from "./components/BookPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StartPage />} />
        {/* <Route path="/question/:id" element={<QuestionPage />} /> */}
        <Route path="/book" element={<BookPage />} />
      </Routes>
    </Router>
  );
}

export default App;
