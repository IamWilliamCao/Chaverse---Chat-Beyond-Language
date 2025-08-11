import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
} from 'firebase/auth';


function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [user, setUser] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [showOriginal, setShowOriginal] = useState({});
  const [modalImage, setModalImage] = useState(null);
  const [usernamesMap, setUsernamesMap] = useState({});
  const [isSignup, setIsSignup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [sendOutLang, setSendOutLang] = useState('en');
  const [receiveLang, setReceiveLang] = useState('en');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const [dictationLang, setDictationLang] = useState('en-US');

  const sendVerificationEmail = async (user) => {
    try {
      await sendEmailVerification(user);
      alert('Verification email sent! Please check your inbox.');
    } catch (error) {
      alert('Failed to send verification email: ' + error.message);
    }
  };

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.lang = dictationLang;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setNewMessage((prev) => `${prev} ${transcript}`.trim());
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
  }, [dictationLang]);



  const messagesRef = collection(db, 'messages');
  const usersRef = collection(db, 'users');
  const messagesEndRef = useRef(null);

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      if (usr) {
        await usr.reload(); // refresh user info
        setUser(usr);
        setIsVerified(usr.emailVerified);

        const userDoc = await getDoc(doc(db, 'users', usr.uid));
        if (userDoc.exists()) {
          setUsername(userDoc.data().username);
        }
      } else {
        setUser(null);
        setIsVerified(false);
        setUsername('');
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isVerified) return;
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const msgs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => a.timestamp?.seconds - b.timestamp?.seconds);
      setMessages(msgs);
    });
    return unsubscribe;
  }, [isVerified]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      }
    }, 50); // small delay ensures stable scroll

    return () => clearTimeout(timeout);
  }, [messages.length]);

  
  useEffect(() => {
    if (!isVerified) return;
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const map = {};
      snapshot.docs.forEach((doc) => {
        map[doc.id] = doc.data().username;
      });
      setUsernamesMap(map);
    });
    return unsubscribe;
  }, [isVerified]);

  const handleSignup = async () => {
    if (!username.trim()) {
      alert('Please enter a username.');
      return;
    }

    const q = query(usersRef, where('username', '==', username.trim()));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      alert('Username already taken.');
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), { username: username.trim() });

      await sendEmailVerification(cred.user); 

      alert('Signup successful! Please verify your email.');
    } catch (err) {
      alert('Signup failed: ' + err.message);
    }
  };

  const handleLogin = async () => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setUser(cred.user);
      setIsVerified(cred.user.emailVerified);
      alert('Login successful!');
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handleSendMessage = async () => {
  if (!newMessage.trim() && !imageFile) return;

  let translatedText = newMessage.trim();
  try {
    if (newMessage.trim()) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

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
        console.error('Translation API error:', res.statusText);
        alert('Translation failed (server issue). Sending original text.');
      } else {
        const data = await res.json();
        translatedText = data.translatedText;
        console.log(`Detected Language: ${data.detectedSource || 'unknown'}`);
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      alert('Translation timed out. Sending original message.');
    } else {
      alert('Translation failed. Sending original message.');
    }
    console.error('Translation error:', err);
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
    originalText: newMessage.trim(),
    image: imageDataUrl,
    timestamp: serverTimestamp(),
  });

  setNewMessage('');
  setImageFile(null);
  document.getElementById('image-input').value = '';

  // Scroll manually in case Firestore is slow
  setTimeout(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100);
};

useEffect(() => {
  if (!isVerified || messages.length === 0) return;

  // Ensure scroll always sticks to bottom reliably, even with variable message/image load
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  };

  const timeout = setTimeout(scrollToBottom, 50);
  return () => clearTimeout(timeout);
}, [messages]);

  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <h2>{isSignup ? 'Sign Up' : 'Login'}</h2>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ display: 'block', marginBottom: 10, padding: 8, width: '300px' }} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ display: 'block', marginBottom: 10, padding: 8, width: '300px' }} />
        {isSignup && (
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={{ display: 'block', marginBottom: 10, padding: 8, width: '300px' }} />
        )}
        <button onClick={isSignup ? handleSignup : handleLogin} style={{ marginRight: 10 }}>
          {isSignup ? 'Sign Up' : 'Login'}
        </button>
        <button onClick={() => setIsSignup((prev) => !prev)}>
          {isSignup ? 'Have an account? Log in' : "Don't have an account? Sign up"}
        </button>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Please verify your email</h2>
        <p>
          A verification link has been sent to your email address.
          Please check your inbox and click the link to verify your account.
        </p>
        <button onClick={() => sendVerificationEmail(user)}>
          Resend verification email
        </button>

        {/* Add refresh button here */}
        <button
          style={{ marginLeft: '10px' }}
          onClick={async () => {
            if (user) {
              await user.reload(); // Refresh user info from Firebase
              setIsVerified(user.emailVerified);
              if (user.emailVerified) {
                alert('Your email is now verified! You can access the app.');
              } else {
                alert('Email not verified yet. Please check your inbox.');
              }
            }
          }}
        >
          Refresh Verification Status
        </button>

        <br />
        <br />
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 20, fontFamily: 'Arial', height: '90vh', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={handleLogout}>Logout</button>
        <button onClick={() => setShowProfile(true)}>Profile</button>
      </div>
      <h2>Thread Messages</h2>

      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', padding: '1rem', backgroundColor: '#fafafa', borderRadius: '4px' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: '1rem' }}>
            <strong>{usernamesMap[msg.uid] || 'Unknown'}</strong>{' '}
            <em>{msg.timestamp?.toDate().toLocaleString() || 'Sending...'}</em>
            <div style={{ backgroundColor: '#e0e0e0', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem', position: 'relative' }}>
              {msg.text && (
                <div>
                  {showOriginal[msg.id] ? msg.originalText || msg.text : msg.text}
                  {msg.originalText && (
                    <button
                      onClick={() =>
                        setShowOriginal((prev) => ({
                          ...prev,
                          [msg.id]: !prev[msg.id],
                        }))
                      }
                      style={{
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        marginLeft: 8,
                      }}
                      title="Toggle original message"
                    >
                      🔁
                    </button>
                  )}
                </div>
              )}

              {msg.image && (
                <img
                  src={msg.image}
                  alt="uploaded"
                  style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '4px', cursor: 'zoom-in' }}
                  onClick={() => setModalImage(msg.image)}
                />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Send Message In: </label>
        <select value={sendOutLang} onChange={(e) => setSendOutLang(e.target.value)}>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="zh-CN">Chinese</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="ar">Arabic</option>
          <option value="ru">Russian</option>
          <option value="hi">Hindi</option>
        </select>
      </div>

<div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
  <textarea
    placeholder="Type your message..."
    value={newMessage}
    onChange={(e) => setNewMessage(e.target.value)}
    style={{
      flex: '1 1 60%',
      padding: '0.5rem',
      resize: 'vertical',
      minHeight: '2.5rem',
      maxHeight: '150px',
      lineHeight: '1.5',
      overflowY: 'auto',
    }}
    onKeyDown={(e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    }}
  />

  <input
    type="file"
    accept="image/jpeg,image/png"
    id="image-input"
    onChange={(e) => setImageFile(e.target.files[0] || null)}
    style={{ flex: '1 1 30%' }}
  />

  <button onClick={handleSendMessage} style={{ flex: '1 1 100px' }}>
    Send
  </button>

<div style={{ marginBottom: '1rem' }}>
  <label>Dictation Input Language: </label>
  <select value={dictationLang} onChange={(e) => setDictationLang(e.target.value)}>
    <option value="en-US">English</option>
    <option value="zh-CN">Chinese (Mandarin)</option>
    <option value="es-ES">Spanish</option>
    <option value="fr-FR">French</option>
    <option value="de-DE">German</option>
    <option value="ja-JP">Japanese</option>
    <option value="ko-KR">Korean</option>
    <option value="ar-SA">Arabic</option>
    <option value="ru-RU">Russian</option>
    <option value="hi-IN">Hindi</option>
  </select>
</div>

  <button
    onClick={() => {
      if (recognitionRef.current && !isListening) {
        setIsListening(true);
        recognitionRef.current.start();
      } else if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
    }}
    style={{
      flex: '1 1 100px',
      backgroundColor: isListening ? '#d9534f' : '#5bc0de',
      color: 'white',
    }}
  >
    {isListening ? 'Stop' : 'Dictate'}
  </button>
</div>



      {showProfile && (
        <div onClick={() => setShowProfile(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px' }}>
            <h3>Profile</h3>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Username:</strong> {username}</p>
            <button onClick={() => setShowProfile(false)}>Close</button>
          </div>
        </div>
      )}

      
    </div>

    
  );
}

export default App;
