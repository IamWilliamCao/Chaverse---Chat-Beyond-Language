import { useState } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";

function AuthForm({ onVerified }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // or "register"

  const handleSubmit = async () => {
    try {
      if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      // Simulate sending a 6-digit code (in real case, use email service)
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      localStorage.setItem("verifyCode", code);
      alert(`Verification Code: ${code}`); // Simulate email

      onVerified(email);
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      <h2>{mode === "register" ? "Register" : "Login"}</h2>
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      /><br/>
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      /><br/>
      <button onClick={handleSubmit}>Continue</button>
      <p onClick={() => setMode(mode === "login" ? "register" : "login")}>
        Switch to {mode === "login" ? "Register" : "Login"}
      </p>
    </div>
  );
}

export default AuthForm;
