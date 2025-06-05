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
} from 'firebase/auth';

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [user, setUser] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [sentCode, setSentCode] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [modalImage, setModalImage] = useState(null);
  const [usernamesMap, setUsernamesMap] = useState({});
  const [isSignup, setIsSignup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [sendOutLang, setSendOutLang] = useState('en');
  const [receiveLang, setReceiveLang] = useState('en');

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
        setUser(usr);
        const vDoc = await getDoc(doc(db, 'emailVerification', usr.uid));
        setIsVerified(vDoc.exists() && vDoc.data().verified === true);

        const userDoc = await getDoc(doc(db, 'users', usr.uid));
        if (userDoc.exists()) {
          setUsername(userDoc.data().username);
        }
      } else {
        setUser(null);
        setIsVerified(false);
        setSentCode(null);
        setVerificationCodeInput('');
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
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  const sendVerificationCode = async () => {
    if (!user) return;
    const code = generateCode();
    setSentCode(code);
    const expiry = Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));
    await setDoc(doc(db, 'emailVerification', user.uid), {
      code,
      expiry,
      verified: false,
    });
    alert(`Verification code sent (simulated): ${code}`);
  };

  const verifyCode = async () => {
    if (!user) return;
    const vDoc = await getDoc(doc(db, 'emailVerification', user.uid));
    if (!vDoc.exists()) {
      alert('No code found. Please request a new one.');
      return;
    }

    const data = vDoc.data();
    if (Timestamp.now().seconds > data.expiry.seconds) {
      alert('Code expired. Please request a new one.');
      return;
    }

    if (verificationCodeInput === data.code) {
      await updateDoc(doc(db, 'emailVerification', user.uid), {
        verified: true,
      });
      setIsVerified(true);
      alert('Email verified! You can now access the thread.');
    } else {
      alert('Incorrect code. Please try again.');
    }
  };

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
      alert('Signup successful! Please verify your email.');
      sendVerificationCode();
    } catch (err) {
      alert('Signup failed: ' + err.message);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert('Login successful!');
      sendVerificationCode();
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
    // Only translate if the output language is NOT English and there is a message
    if (sendOutLang !== 'en' && newMessage.trim()) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 sec timeout

      console.log('Translating:', newMessage.trim(), 'to', sendOutLang);

      const res = await fetch('http://127.0.0.1:5001/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newMessage.trim(),
          source: 'en',
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
    image: imageDataUrl,
    timestamp: serverTimestamp(),
  });

  setNewMessage('');
  setImageFile(null);
  document.getElementById('image-input').value = '';
};


  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <h2>{isSignup ? 'Sign Up' : 'Login'}</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: 'block', marginBottom: 10, padding: 8, width: '300px' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', marginBottom: 10, padding: 8, width: '300px' }}
        />
        {isSignup && (
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ display: 'block', marginBottom: 10, padding: 8, width: '300px' }}
          />
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
        <h2>Email Verification</h2>
        <input
          type="text"
          placeholder="Enter 6-digit code"
          value={verificationCodeInput}
          onChange={(e) => setVerificationCodeInput(e.target.value)}
          maxLength={6}
          style={{ padding: 8, width: '200px', marginRight: 10 }}
        />
        <button onClick={verifyCode} style={{ marginRight: 10 }}>
          Verify
        </button>
        <button onClick={sendVerificationCode}>Resend Code</button>
        <br />
        <br />
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
        fontFamily: 'Arial',
        height: '90vh',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={handleLogout}>Logout</button>
        <button onClick={() => setShowProfile(true)}>Profile</button>
      </div>

      <h2>Thread Messages</h2>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid #ddd',
          padding: '1rem',
          backgroundColor: '#fafafa',
          borderRadius: '4px',
        }}
      >
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: '1rem' }}>
            <strong>{usernamesMap[msg.uid] || 'Unknown'}</strong>{' '}
            <em>{msg.timestamp?.toDate().toLocaleString() || 'Sending...'}</em>
            <div
              style={{
                backgroundColor: '#e0e0e0',
                padding: '0.5rem',
                borderRadius: '4px',
                marginTop: '0.5rem',
              }}
            >
              {msg.text && <div>{msg.text}</div>}
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
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          style={{ flex: '1 1 60%', padding: '0.5rem' }}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
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
      </div>

      {modalImage && (
        <div
          onClick={() => setModalImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <img
            src={modalImage}
            alt="full-size"
            style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px' }}
          />
        </div>
      )}

      {showProfile && (
        <div
          onClick={() => setShowProfile(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px' }}>
            <h3>Profile</h3>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
            <p>
              <strong>Username:</strong> {username}
            </p>
            <button onClick={() => setShowProfile(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
