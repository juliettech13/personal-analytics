export function Ticker({ text }: { text: string }) {
  return (
    <div className="mb-3 overflow-hidden border-y border-[#333] bg-chrome-darker text-[#FFD060]">
      <div className="animate-[ticker_60s_linear_infinite] inline-block py-0.5 font-pixel text-[15px] whitespace-nowrap">
        {text}
      </div>
    </div>
  );
}
