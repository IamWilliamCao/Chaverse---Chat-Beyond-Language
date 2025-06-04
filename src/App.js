import { useState, useEffect, useRef } from 'react';

function App() {
  // Name states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [savedName, setSavedName] = useState(null);

  // Thread states
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);

  // Timer state (in seconds)
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes = 600 seconds
  const timerRef = useRef(null);

  // Load saved data on mount
  useEffect(() => {
    const saved = localStorage.getItem('savedName');
    if (saved) {
      setSavedName(JSON.parse(saved));
    }

    const savedMessages = localStorage.getItem('threadMessages');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
  }, []);

  // Timer logic
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearMessages();
          return 600; // reset timer to 10 minutes
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, []);

  // Clear messages function
  const clearMessages = () => {
    setMessages([]);
    localStorage.removeItem('threadMessages');
  };

  // Save name handler
  const handleSave = () => {
    const name = { firstName, lastName };
    setSavedName(name);
    localStorage.setItem('savedName', JSON.stringify(name));
    setFirstName('');
    setLastName('');
  };

  // Helper: convert image file to base64
  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });

  // Send message handler
  const handleSendMessage = async () => {
    if (!newMessage.trim() && !imageFile) return; // ignore empty if no image

    let imageDataUrl = null;
    if (imageFile) {
      try {
        imageDataUrl = await toBase64(imageFile);
      } catch (e) {
        alert('Failed to read image file');
        return;
      }
    }

    const messageObj = {
      id: Date.now(),
      text: newMessage.trim(),
      image: imageDataUrl,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, messageObj];
    setMessages(updatedMessages);
    localStorage.setItem('threadMessages', JSON.stringify(updatedMessages));
    setNewMessage('');
    setImageFile(null);
    // Reset file input value (hack)
    document.getElementById('image-input').value = '';
  };

  // Format timer display mm:ss
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={{
      display: 'flex',
      padding: '2rem',
      fontFamily: 'Arial',
      height: '90vh',
      gap: '2rem',
      flexDirection: 'column',
    }}>
      {/* Timer on top */}
      <div style={{
        textAlign: 'center',
        fontSize: '1.2rem',
        marginBottom: '1rem',
        fontWeight: 'bold',
      }}>
        Thread clears in: {formatTime(timeLeft)}
      </div>

      {/* Main content: side by side */}
      <div style={{ display: 'flex', flex: 1, gap: '2rem' }}>
        {/* Left Section: Name input */}
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
          <h2>Enter Your Name</h2>
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={{ marginRight: '1rem', padding: '0.5rem' }}
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={{ padding: '0.5rem' }}
          />
          <br /><br />
          <button onClick={handleSave} style={{ padding: '0.5rem 1rem' }}>
            Save
          </button>

          {savedName && (
            <div style={{ marginTop: '2rem' }}>
              <strong>Saved:</strong> {savedName.firstName} {savedName.lastName}
            </div>
          )}
        </div>

        {/* Right Section: Thread */}
        <div style={{
          flex: 1,
          border: '1px solid #ccc',
          padding: '1rem',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}>
          <h2>Thread</h2>

          {/* Messages list */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid #ddd',
            padding: '0.5rem',
            marginBottom: '1rem',
            borderRadius: '4px',
            backgroundColor: '#fafafa'
          }}>
            {messages.length === 0 && <p>No messages yet.</p>}
            {messages.map(msg => (
              <div key={msg.id} style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: '#555' }}>
                  {new Date(msg.timestamp).toLocaleString()}
                </div>
                <div style={{
                  backgroundColor: '#e0e0e0',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  maxWidth: '80%'
                }}>
                  {msg.text && <div style={{ marginBottom: msg.image ? '0.5rem' : 0 }}>{msg.text}</div>}
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="uploaded"
                      style={{ maxWidth: '100%', borderRadius: '4px' }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* New message input + image upload */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              style={{ flex: '1 1 60%', padding: '0.5rem' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
            />
            <input
              type="file"
              accept="image/*"
              id="image-input"
              onChange={(e) => setImageFile(e.target.files[0])}
              style={{ flex: '1 1 30%' }}
            />
            <button
              onClick={handleSendMessage}
              style={{ padding: '0.5rem 1rem', flex: '1 1 100px' }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
