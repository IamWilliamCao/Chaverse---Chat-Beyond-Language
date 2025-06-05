// src/App.js
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
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

function App() {
  // Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [user, setUser] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [sentCode, setSentCode] = useState(null);

  // Messaging states
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [modalImage, setModalImage] = useState(null);

  const [usernamesMap, setUsernamesMap] = useState({});

  const messagesRef = collection(db, 'messages');
  const usersRef = collection(db, 'users');
  const verificationRef = doc(db, 'emailVerification', 'codes');

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
      alert('Username already taken, please choose another.');
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      await setDoc(doc(db, 'users', uid), {
        username: username.trim(),
      });

      alert('Signup successful! Please verify your email with the code.');
      sendVerificationCode();
    } catch (err) {
      alert('Signup failed: ' + err.message);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert('Login successful! Please verify your email with the code if not verified.');
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
      text: newMessage.trim(),
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
        <h2>Login / Signup</h2>
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
        <input
          type="text"
          placeholder="Choose a username (cannot change later)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ display: 'block', marginBottom: 10, padding: 8, width: '300px' }}
        />
        <button onClick={handleLogin} style={{ marginRight: 10 }}>Login</button>
        <button onClick={handleSignup}>Sign Up</button>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Email Verification</h2>
        <p>We sent a 6-digit code to your email.</p>
        <input
          type="text"
          placeholder="Enter 6-digit code"
          value={verificationCodeInput}
          onChange={(e) => setVerificationCodeInput(e.target.value)}
          maxLength={6}
          style={{ padding: 8, width: '200px', marginRight: 10 }}
        />
        <button onClick={verifyCode} style={{ marginRight: 10 }}>Verify</button>
        <button onClick={sendVerificationCode}>Resend Code</button>
        <br /><br />
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        padding: '2rem',
        fontFamily: 'Arial',
        height: '90vh',
        gap: '2rem',
        flexDirection: 'column',
      }}
    >
      <button onClick={handleLogout} style={{ alignSelf: 'flex-end' }}>Logout</button>
      <h2>Thread Messages</h2>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid #ddd',
          padding: '0.5rem',
          marginBottom: '1rem',
          borderRadius: '4px',
          backgroundColor: '#fafafa',
          resize: 'both',
          minHeight: '150px',
          maxHeight: '70vh',
          overflow: 'auto',
        }}
      >
        {messages.length === 0 && <p>No messages yet.</p>}
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.9rem', color: '#555' }}>
              <strong>{usernamesMap[msg.uid] || 'Unknown'}</strong>{' '}
              <em>{msg.timestamp ? msg.timestamp.toDate().toLocaleString() : 'Sending...'}</em>
            </div>
            <div
              style={{
                backgroundColor: '#e0e0e0',
                padding: '0.5rem',
                borderRadius: '4px',
                maxWidth: '80%',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
              }}
            >
              {msg.text && <div style={{ marginBottom: msg.image ? '0.5rem' : 0 }}>{msg.text}</div>}
              {msg.image && (
                <img
                  src={msg.image}
                  alt="uploaded"
                  style={{
                    maxWidth: '200px',
                    maxHeight: '150px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    cursor: 'zoom-in',
                  }}
                  onClick={() => setModalImage(msg.image)}
                />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* New Message Input */}
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
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              if (file.size > 750000) {
                alert('Image must be less than 750 KB');
                e.target.value = null;
                setImageFile(null);
                return;
              }
              if (!['image/jpeg', 'image/png'].includes(file.type)) {
                alert('Only JPEG or PNG images are allowed');
                e.target.value = null;
                setImageFile(null);
                return;
              }
              setImageFile(file);
            } else {
              setImageFile(null);
            }
          }}
          style={{ flex: '1 1 30%' }}
        />
        <button
          onClick={handleSendMessage}
          style={{ padding: '0.5rem 1rem', flex: '1 1 100px' }}
        >
          Send
        </button>
      </div>

      {/* Image Modal */}
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
            cursor: 'zoom-out',
          }}
        >
          <img
            src={modalImage}
            alt="full-size"
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              borderRadius: '8px',
              boxShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
            }}
          />
        </div>
      )}
    </div>
  );
}

export default App;
