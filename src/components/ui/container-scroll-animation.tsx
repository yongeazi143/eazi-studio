"use client";
import React, { useRef } from "react";
import { useScroll, useTransform, motion, MotionValue } from "motion/react";

export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode | ((progress: any) => React.ReactNode);
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.8, 0.95] : [1.05, 1];
  };

  // Card rotation and scaling complete as it scrolls into view (progress 0 to 0.4)
  const rotate = useTransform(scrollYProgress, [0, 0.4], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.4], scaleDimensions());

  return (
    <div
      className="relative w-full h-[260vh]"
      ref={containerRef}
    >
      {/* Title / Hero Header in normal scroll flow so it never gets clipped */}
      <div className="max-w-5xl mx-auto text-center pt-8 pb-12 px-4 relative z-20">
        {titleComponent}
      </div>

      {/* Sticky container for the 3D-to-flat mockup card */}
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden px-4 md:px-12 py-4 z-10">
        <div
          className="w-full max-w-5xl mx-auto flex items-center justify-center relative"
          style={{
            perspective: "1000px",
          }}
        >
          <Card rotate={rotate} scale={scale}>
            {typeof children === "function" ? children(scrollYProgress) : children}
          </Card>
        </div>
      </div>
    </div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className="max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto w-full h-auto aspect-[2] border border-white/10 bg-black/40 rounded-[24px] shadow-2xl overflow-hidden p-0"
    >
      <div className="h-full w-full overflow-hidden bg-zinc-950 rounded-[inherit]">
        {children}
      </div>
    </motion.div>
  );
};

