from flask import Flask, request, jsonify, send_file
from datetime import datetime
from flask_cors import CORS
import os
import pickle
from langdetect import detect, DetectorFactory
from deep_translator import GoogleTranslator
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.chains import ConversationalRetrievalChain
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from gtts import gTTS

# Initialize environment variables and configurations
load_dotenv()
google_api_key = os.getenv("GOOGLE_API_KEY")
DetectorFactory.seed = 0

# Load embeddings and Chroma DB
huggingface_embeddings = pickle.load(open("huggingface_embeddings.pkl", "rb"))
persistent_directory = "db/extended_chroma_db_with_metadata"
db = Chroma(persist_directory=persistent_directory, embedding_function=huggingface_embeddings)
retriever = db.as_retriever(search_type="similarity", search_kwargs={"k": 3})
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", api_key=google_api_key)

# Initialize Conversational Chain
conversational_chain = ConversationalRetrievalChain.from_llm(llm=llm, retriever=retriever)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    query = data.get("query")

    if not query:
        return jsonify({"response": "Query is required!"}), 400

    # Detect language
    try:
        language = detect(query)
        print(f"Detected language: {language}")
    except Exception as e:
        return jsonify({"response": "Failed to detect language.", "error": str(e)}), 500

    # Translate Punjabi to English if necessary
    if language.lower() == "pa":  # Punjabi language code
        try:
            query = GoogleTranslator(source='pa', target='en').translate(query)
        except Exception as e:
            return jsonify({"response": "Failed to translate query.", "error": str(e)}), 500

    # Print query
    print(f"Query asked: {query}")

    # Get response from the AI model
    try:
        result = conversational_chain.invoke({"question": query, "chat_history": []})
        response = result.get("answer", "No response available.")
        print(f"Generated response: {response}")
    except Exception as e:
        return jsonify({"response": "Failed to generate AI response.", "error": str(e)}), 500

    # Translate response to Punjabi if the query was in Punjabi
    if language.lower() == "pa":
        try:
            response = GoogleTranslator(source='en', target='pa').translate(response)
        except Exception as e:
            return jsonify({"response": "Failed to translate response.", "error": str(e)}), 500

    # Create audio file from response
    try:
        tts = gTTS(text=response, lang=language.lower(), slow=False)
        audio_file_path = "response_audio.mp3"
        tts.save(audio_file_path)
    except Exception as e:
        return jsonify({"response": "Failed to generate audio response.", "error": str(e)}), 500

    # Print response
    print(f"Response: {response}")

    # Return JSON response along with audio file
    return jsonify({
        "response": response,
        "audio_file_url": f"/audio/{audio_file_path}"
    })

@app.route("/audio/<filename>")
def serve_audio(filename):
    try:
        return send_file(filename, as_attachment=True)
    except Exception as e:
        return jsonify({"response": "Failed to send audio file.", "error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
