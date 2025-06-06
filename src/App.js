import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';

import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

const messagesRef = collection(db, 'messages');

const App = () => {
  const [user, setUser] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [sendOutLang, setSendOutLang] = useState('en');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(messagesRef, orderBy('timestamp')), (snapshot) => {
      const updatedMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(updatedMessages);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !imageFile) return;

    let translatedText = newMessage.trim();
    try {
      if (sendOutLang !== 'en' && newMessage.trim()) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000); // 7 seconds

        const res = await fetch('https://wackie-talkie.onrender.com/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: newMessage.trim(),
            source: 'auto',
            target: sendOutLang,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          console.error('Translation API error:', res.status, errText);
          alert('Translation failed (server issue). Sending original text.');
        } else {
          const data = await res.json();
          if (data.translatedText) {
            translatedText = data.translatedText;
            console.log(`Detected Language: ${data.detectedSource || 'unknown'}`);
          } else {
            alert('Translation failed (invalid response). Sending original text.');
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        alert('Translation timed out. Sending original message.');
      } else {
        alert('Translation error. Sending original message.');
        console.error(err);
      }
    }

    let imageDataUrl = null;
    if (imageFile) {
      try {
        imageDataUrl = await toBase64(imageFile);
      } catch {
        alert('Image error');
        return;
      }
    }

    await addDoc(messagesRef, {
      uid: user.uid,
      text: translatedText,
      image: imageDataUrl,
      timestamp: serverTimestamp(),
    });

    setNewMessage('');
    setImageFile(null);
    document.getElementById('image-input').value = '';
  };

  const handleSignUp = async () => {
    const email = prompt('Email:');
    const password = prompt('Password:');
    if (!email || !password) return;
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      setUser(userCred.user);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSignIn = async () => {
    const email = prompt('Email:');
    const password = prompt('Password:');
    if (!email || !password) return;
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCred.user);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="App">
      <h1>Wackie Talkie 🌐</h1>
      {!user ? (
        <>
          <button onClick={handleSignIn}>Sign In</button>
          <button onClick={handleSignUp}>Sign Up</button>
        </>
      ) : (
        <>
          <div className="chat-box">
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.uid === user.uid ? 'own' : ''}`}>
                <p>{msg.text}</p>
                {msg.image && <img src={msg.image} alt="upload" style={{ maxWidth: '200px' }} />}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="controls">
            <select
              value={sendOutLang}
              onChange={(e) => setSendOutLang(e.target.value)}
            >
              <option value="en">English</option>
              <option value="zh">Chinese</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              {/* Add more languages if needed */}
            </select>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
            />
            <input
              type="file"
              id="image-input"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files[0])}
            />
            <button onClick={handleSendMessage}>Send</button>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
