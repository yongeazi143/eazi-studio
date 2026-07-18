import { ListVideo } from "lucide-react";

interface Scene {
  id: string;
  text: string;
  prompt: string;
  timeStart: number;
  timeEnd: number;
}

interface TranscriptViewProps {
  scenes: Scene[];
}

export default function TranscriptView({ scenes }: TranscriptViewProps) {
  if (!scenes || scenes.length === 0) {
    return (
      <div className="glass-card p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-4 text-[#7B7890]">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
            <ListVideo className="w-6 h-6" />
          </div>
          <p>Processing transcript and generating scenes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 h-full max-h-[800px] overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-3 mb-6 sticky top-0 bg-[#0D0B1E]/90 backdrop-blur-md py-2 z-10">
        <ListVideo className="w-5 h-5 text-[#9B6FF7]" />
        <h3 className="text-lg font-bold text-white">Transcript & Scenes</h3>
      </div>
      
      <div className="space-y-4">
        {scenes.map((scene, index) => (
          <div key={scene.id} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#8B5CF6]/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#9B6FF7] bg-[#7C3AED]/20 px-2 py-1 rounded-md">
                Scene {index + 1}
              </span>
              <span className="text-xs font-mono text-[#7B7890]">
                {scene.timeStart.toFixed(1)}s - {scene.timeEnd.toFixed(1)}s
              </span>
            </div>
            <p className="text-sm text-white/90 leading-relaxed mb-3">
              "{scene.text}"
            </p>
            <div className="p-3 bg-black/20 rounded-lg">
              <p className="text-xs text-[#C4C0D8] font-medium mb-1">Image Prompt:</p>
              <p className="text-xs text-[#7B7890] italic">{scene.prompt}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
