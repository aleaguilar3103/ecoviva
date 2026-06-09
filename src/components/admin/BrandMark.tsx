// Marca de EcoViva: hoja sobre fondo verde de marca (hsl(152 68% 28%)).
export default function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[60%] w-[60%]">
        <path
          d="M5 19c0-7 5-13 14-14-1 9-6 14-14 14Z"
          fill="currentColor"
          opacity="0.95"
        />
        <path
          d="M6 18C9 13 13 9 17 7"
          stroke="#065f46"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
