import { Box, Button, Icon } from "@chakra-ui/react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { IoIosPlayCircle } from "react-icons/io";

type Props = {
  onPIPHandle: (state: boolean) => void;
};

const CameraFeed = (props: Props) => {
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [config] = useState<RTCConfiguration>({
    iceServers: [],
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  const addTrack = useCallback((evt: any) => {
    console.log("Received track:", evt.track.kind);
    if (evt.track.kind === "video") {
      if (videoRef.current) {
        videoRef.current.srcObject = evt.streams[0];
        console.log("Video stream set");
      }
    }
  }, []);

  const stopStream = useCallback(async () => {
    if (pc) {
      // Remove event listeners first
      pc.removeEventListener("track", addTrack);
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;

      // Close connection
      pc.close();
    }

    if (videoRef.current) {
      // Pause and reset video element
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.load(); // Reset video element state
    }

    setPc(null);
    setIsPlaying(false);
  }, [pc, addTrack]);

  const negotiate = useCallback(async () => {
    if (!pc) return;

    try {
      // Only add video transceiver for receiving
      await pc.addTransceiver("video", { direction: "recvonly" });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise((resolve: any) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", checkState);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", checkState);
        }
      });

      const response = await fetch("http://192.168.0.21:8080/offer", {
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          type: pc.localDescription?.type,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const answer = await response.json();
      await pc.setRemoteDescription(answer);
      console.log("WebRTC connection established");
    } catch (error) {
      console.error("Negotiation failed:", error);
      stopStream();
      alert(`Connection failed: ${error}`);
    }
  }, [pc, stopStream]);

  const startStream = async () => {
    // Ensure previous connection is fully cleaned up
    if (pc) {
      await stopStream();
      // Add small delay to ensure cleanup completes
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const newPc = new RTCPeerConnection(config);

    newPc.onconnectionstatechange = () => {
      console.log("Connection state:", newPc.connectionState);
      if (
        newPc.connectionState === "failed" ||
        newPc.connectionState === "closed"
      ) {
        stopStream();
      }
    };

    setPc(newPc);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (!pc) return;

    pc.addEventListener("track", addTrack);
    negotiate();

    return () => {
      if (pc) {
        pc.close();
        pc.removeEventListener("track", addTrack);
      }
    };
  }, [pc, addTrack, negotiate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPiP = () => {
      console.log("Entered Picture-in-Picture");
      props.onPIPHandle(true);
    };

    const handleLeavePiP = () => {
      console.log("Left Picture-in-Picture");
      props.onPIPHandle(false);
    };

    video.addEventListener("enterpictureinpicture", handleEnterPiP);
    video.addEventListener("leavepictureinpicture", handleLeavePiP);

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnterPiP);
      video.removeEventListener("leavepictureinpicture", handleLeavePiP);
    };
  }, [props, props.onPIPHandle]);

  return (
    <Box h={"100%"} position={"relative"} mb={2}>
      <video
        width={"100%"}
        ref={videoRef}
        autoPlay={true}
        playsInline={true}
        className="live-video"
        onError={(e) => console.error("Video error:", e)}
        controls
      ></video>
      {isPlaying ? (
        <Button onClick={stopStream} mt={2} mx={2}>
          Stop streaming
        </Button>
      ) : (
        <div>
          <Icon
            zIndex={1000}
            onClick={startStream}
            className="buttonhover"
            position={"absolute"}
            as={IoIosPlayCircle}
            color={"white"}
            w={"80px"}
            height={"80px"}
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          ></Icon>
        </div>
      )}
    </Box>
  );
};

export default CameraFeed;
