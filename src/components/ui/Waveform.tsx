import { useEffect, useRef, useState } from "react";
import { getAudioLevels } from "@/lib/audioUtils";

interface WaveformProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
  barCount?: number;
  barWidth?: number;
  barGap?: number;
  barColor?: string;
  barActiveColor?: string;
  height?: number;
}

export default function Waveform({
  analyser,
  isRecording,
  barCount = 32,
  barWidth = 3,
  barGap = 2,
  barColor = "#444",
  barActiveColor = "#3B82F6",
  height = 48,
}: WaveformProps) {
  const [levels, setLevels] = useState<number[]>(new Array(barCount).fill(0.1));
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRecording || !analyser) {
      // Reset to idle state
      setLevels(new Array(barCount).fill(0.1));
      return;
    }

    const updateLevels = () => {
      const newLevels = getAudioLevels(analyser, barCount);
      setLevels(newLevels);
      animationRef.current = requestAnimationFrame(updateLevels);
    };

    updateLevels();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isRecording, barCount]);

  const totalWidth = barCount * barWidth + (barCount - 1) * barGap;

  return (
    <div
      className="flex items-center justify-center gap-[2px]"
      style={{ height, width: totalWidth }}
    >
      {levels.map((level, index) => {
        const barHeight = Math.max(4, level * height * 0.9);
        return (
          <div
            key={index}
            className="transition-all duration-75 rounded-full"
            style={{
              width: barWidth,
              height: barHeight,
              backgroundColor: isRecording ? barActiveColor : barColor,
            }}
          />
        );
      })}
    </div>
  );
}

// Static waveform for playback visualization
interface StaticWaveformProps {
  audioUrl: string;
  progress?: number; // 0-1
  barCount?: number;
  barWidth?: number;
  barGap?: number;
  barColor?: string;
  barActiveColor?: string;
  height?: number;
}

export function StaticWaveform({
  audioUrl,
  progress = 0,
  barCount = 32,
  barWidth = 3,
  barGap = 2,
  barColor = "#444",
  barActiveColor = "#3B82F6",
  height = 48,
}: StaticWaveformProps) {
  const [levels, setLevels] = useState<number[]>(new Array(barCount).fill(0.3));

  useEffect(() => {
    // Generate pseudo-random waveform from URL hash
    const hash = audioUrl.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const newLevels = new Array(barCount).fill(0).map((_, i) => {
      const seed = (hash + i * 17) % 100;
      return 0.2 + (seed / 100) * 0.6;
    });
    setLevels(newLevels);
  }, [audioUrl, barCount]);

  const totalWidth = barCount * barWidth + (barCount - 1) * barGap;
  const activeIndex = Math.floor(progress * barCount);

  return (
    <div
      className="flex items-center justify-center gap-[2px]"
      style={{ height, width: totalWidth }}
    >
      {levels.map((level, index) => {
        const barHeight = Math.max(4, level * height * 0.9);
        const isActive = index <= activeIndex;
        return (
          <div
            key={index}
            className="rounded-full"
            style={{
              width: barWidth,
              height: barHeight,
              backgroundColor: isActive ? barActiveColor : barColor,
            }}
          />
        );
      })}
    </div>
  );
}
