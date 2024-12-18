import React, { useState, useEffect, useRef } from "react";
import PunjabiKeyboard from "./PunjabiKeyboard";
import axios from "axios";

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sttConfig, setSttConfig] = useState(null);
  const chatContainerRef = useRef(null);
  const recognitionRef = useRef(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001/chat";

  // Load STT Configuration
  useEffect(() => {
    const fetchSttConfig = async () => {
      try {
        const response = await axios.get("/stt.json");
        setSttConfig(response.data);
      } catch (error) {
        console.error("Error loading STT configuration:", error);
      }
    };
    fetchSttConfig();
  }, []);

  // Text-to-Speech
  const playTextToSpeech = (text) => {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = sttConfig?.language_code || "en-US";
    synth.speak(utterance);
  };

  // Speech-to-Text (STT)
  const startListening = () => {
    if (!("SpeechRecognition" in window)) {
      alert("Your browser does not support Speech Recognition.");
      return;
    }

    if (!sttConfig) {
      alert("STT configuration not loaded yet.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = sttConfig.language_code;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      setInput(transcript);
    };

    recognitionRef.current.onend = () => setIsListening(false);

    recognitionRef.current.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      setIsListening(false);
    };

    recognitionRef.current.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const handleSend = async () => {
    if (input.trim()) {
      const userMessage = { text: input, type: "user" };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);

      try {
        const response = await axios.post(BACKEND_URL, { query: input });
        const botReply = response.data.response?.trim() || "No response from the bot.";
        const audioFile = response.data.audio_file; // URL of the audio file

        setMessages((prev) => [
          ...prev,
          { text: botReply, type: "bot", audio: audioFile },
        ]);

        // Text-to-Speech for Bot Reply
        playTextToSpeech(botReply);
      } catch (error) {
        console.error("Error:", error);
        const errorMessage = "Error connecting to the server. Try again later.";
        setMessages((prev) => [...prev, { text: errorMessage, type: "bot" }]);
        playTextToSpeech(errorMessage); // Speak error message
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const toggleKeyboard = () => setIsKeyboardVisible(!isKeyboardVisible);

  return (
    <div className="flex flex-col h-[610px] bg-whatsapp-dark overflow-hidden">
      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 bg-gray-light border border-medium rounded-t-md"
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex items-start ${
              msg.type === "user" ? "justify-end" : "justify-start"
            } mb-2`}
          >
            <div
              className={`p-3 rounded-lg max-w-[75%] break-words ${
                msg.type === "user"
                  ? "bg-whatsapp-dark text-white"
                  : "bg-gray-medium text-black"
              }`}
            >
              {msg.text}
            </div>
            {/* Play Audio Button for Bot Messages */}
            {msg.type === "bot" && msg.audio && (
              <button
                className="ml-2 p-2 bg-whatsapp-dark text-white rounded-md hover:bg-hover transition"
                onClick={() => playTextToSpeech(msg.text)}
              >
                Play Audio
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Input Section */}
      <div className="flex flex-col p-4 bg-gray-light border-t border-medium">
        <div className="flex items-center space-x-4">
          <input
            type="text"
            className="flex-1 p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-800 focus:outline-none focus:ring-2 focus:ring-whatsapp-dark"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
          />
          <button
            className={`p-3 rounded-lg bg-whatsapp-dark text-white hover:bg-hover transition-colors duration-300 ${
              !input.trim() && "opacity-50 cursor-not-allowed"
            }`}
            onClick={handleSend}
            disabled={!input.trim()}
          >
            {loading ? (
              <div className="w-5 h-5 border-4 border-t-4 border-white rounded-full animate-spin"></div>
            ) : (
              "Send"
            )}
          </button>
          {/* Speech-to-Text Button */}
          <button
            className={`p-3 rounded-lg bg-whatsapp-dark text-white hover:bg-hover transition ${
              isListening && "bg-red-500"
            }`}
            onClick={isListening ? stopListening : startListening}
          >
            🎤
          </button>
        </div>

        {/* Punjabi Keyboard */}
        {isKeyboardVisible && (
          <div className="mt-4 max-h-45 overflow-auto">
            <PunjabiKeyboard onInput={setInput} />
          </div>
        )}

        <button
          className="mt-2 p-2 bg-whatsapp-dark text-white rounded-md hover:bg-hover transition"
          onClick={toggleKeyboard}
        >
          {isKeyboardVisible ? "Hide Keyboard" : "Show Keyboard"}
        </button>
      </div>
    </div>
  );
};

export default Chatbot;
