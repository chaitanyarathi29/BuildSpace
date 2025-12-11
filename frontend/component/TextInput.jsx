import React from "react";

export default function TextInput({
  label,
  value,
  onChange,
  disabled = false,
  className = "",
}) {
  return (
    <div className={`relative w-full mb-5 ${className}`}>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        className={`
          w-full px-4 py-3 rounded-lg bg-[#0d0d0d] text-white
          border border-gray-700
          focus:border-blue-500 focus:ring-2 focus:ring-blue-600/40
          outline-none transition-all peer
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      />

      {/* Floating Label */}
      <label
        className={`
          absolute left-4 top-3 text-gray-400 pointer-events-none
          transition-all duration-200 ease-out
          bg-[#0d0d0d] px-1

          peer-placeholder-shown:top-3 peer-placeholder-shown:text-base 
          peer-placeholder-shown:text-gray-500

          peer-focus:-top-2 peer-focus:text-sm peer-focus:text-blue-400
        `}
      >
        {label}
      </label>
    </div>
  );
}
