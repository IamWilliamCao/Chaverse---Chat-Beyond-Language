import { useState } from "react";

function VerifyCode({ email, onSuccess }) {
  const [inputCode, setInputCode] = useState("");

  const handleVerify = () => {
    const savedCode = localStorage.getItem("verifyCode");
    if (inputCode === savedCode) {
      onSuccess(email);
    } else {
      alert("Invalid code");
    }
  };

  return (
    <div>
      <h2>Enter 6-digit Verification Code</h2>
      <input
        value={inputCode}
        onChange={(e) => setInputCode(e.target.value)}
        placeholder="Enter code"
      />
      <button onClick={handleVerify}>Verify</button>
    </div>
  );
}

export default VerifyCode;
