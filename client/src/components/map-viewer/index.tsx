import React from "react";
import { RosContext } from "../../context/RosContext";
import { Topic } from "roslib";
import { Box, Skeleton } from "@chakra-ui/react";

const MapViewer = () => {
  const ZOOM_IN_FACTOR = 1.1;
  const ZOOM_OUT_FACTOR = 0.9;
  const ROBOT_BASE_SIZE = 3;

  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  const rosContext = React.useContext(RosContext);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<HTMLCanvasElement>(null);
  const mapImage = React.useRef<ImageBitmap | null>(null);

  const robotPosition = React.useRef<{ x: number; y: number; angle: number }>({
    x: 0,
    y: 0,
    angle: 0,
  });

  const zoomFactor = React.useRef<number>(1);

  const useMock = !rosContext?.state;

  React.useEffect(() => {
    let animationFrameId: number;

    const mapParams = {
      width: 0,
      height: 0,
      resolution: 1,
      origin: { x: 0, y: 0 },
    };

    const draw = () => {
      if (!mapRef.current) return;

      const canvas = mapRef.current;
      const context = canvas.getContext("2d");

      if (!mapImage.current || !containerRef.current || !context) return;

      const RW = mapParams.width;
      const RH = mapParams.height;

      const CW = containerRef.current.clientWidth;
      const CH = containerRef.current.clientHeight;

      canvas.width = CW;
      canvas.height = CH;

      const scale = Math.min(CW / RW, CH / RH);
      const totalScale = scale * zoomFactor.current;

      context.resetTransform();
      context.transform(1, 0, 0, -1, 0, canvas.height);

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;

      context.translate((CW - RW * totalScale) / 2, (CH - RH * totalScale) / 2);
      context.scale(totalScale, totalScale);

      context.drawImage(
        mapImage.current,
        0,
        0,
        mapParams.width,
        mapParams.height
      );

      const robotSize = ROBOT_BASE_SIZE;
      const x = robotPosition.current.x;
      const y = robotPosition.current.y;
      const angle = robotPosition.current.angle;

      context.save();

      context.translate(x, y);
      context.rotate(angle);

      context.beginPath();
      context.moveTo(robotSize, 0);
      context.lineTo(-robotSize, -robotSize);
      context.lineTo(-robotSize, robotSize);
      context.closePath();

      context.fillStyle = "#FF0000";
      context.strokeStyle = "#000000";
      context.lineWidth = 1;
      context.fill();
      context.stroke();

      context.restore();

      animationFrameId = requestAnimationFrame(draw);
    };

    if (!useMock && rosContext.state) {
      const mapClient = new Topic({
        ros: rosContext.state,
        name: "/map",
        messageType: "nav_msgs/OccupancyGrid",
      });

      const robotPoseClient = new Topic({
        ros: rosContext.state,
        name: "/robot_pose",
        messageType: "geometry_msgs/msg/PoseStamped",
      });

      const handleMapMessage = async (map: any) => {
        const { info, data } = map;
        mapParams.width = info.width;
        mapParams.height = info.height;
        mapParams.resolution = info.resolution;
        mapParams.origin = {
          x: info.origin.position.x,
          y: info.origin.position.y,
        };

        const imageData = new ImageData(info.width, info.height);
        for (let i = 0; i < data.length; i++) {
          const row = Math.floor(i / info.width);
          const col = i % info.width;
          const imageIndex = (row * info.width + col) * 4;

          const val = data[i];
          const [r, g, b] =
            val === 100
              ? [0, 0, 0]
              : val === 0
              ? [255, 255, 255]
              : [255 - val * 2.55, 255 - val * 2.55, 255 - val * 2.55];

          imageData.data[imageIndex] = r;
          imageData.data[imageIndex + 1] = g;
          imageData.data[imageIndex + 2] = b;
          imageData.data[imageIndex + 3] = 255;
        }

        mapImage.current = await createImageBitmap(imageData);

        if (isLoading) {
          setIsLoading(false);
        }

        animationFrameId = requestAnimationFrame(draw);
      };

      const handlePoseStampedMessage = (poseStamped: any) => {
        const { position, orientation } = poseStamped.pose;

        const q = orientation;
        const yaw = Math.atan2(
          2 * (q.w * q.z + q.x * q.y),
          1 - 2 * (q.y * q.y + q.z * q.z)
        );

        const mapOriginMapped = {
          x: (-1 * mapParams.origin.x + position.x) / mapParams.resolution,
          y: (-1 * mapParams.origin.y + position.y) / mapParams.resolution,
          angle: yaw,
        };

        robotPosition.current = mapOriginMapped;
      };

      mapClient.subscribe(handleMapMessage);
      robotPoseClient.subscribe(handlePoseStampedMessage);
      return () => {
        mapClient.unsubscribe();
        robotPoseClient.unsubscribe();
        cancelAnimationFrame(animationFrameId);
      };
    } else {
      const W = 30,
        H = 50;
      let mapTimer = window.setInterval(async () => {
        mapParams.width = W;
        mapParams.height = H;
        mapParams.resolution = 1;
        mapParams.origin = {
          x: 0,
          y: 0,
        };

        const data = new Array(W * H).fill(0).map(() => {
          return Math.random() < 0.1 ? 100 : 0;
        });
        const imgData = new ImageData(W, H);
        data.forEach((v, i) => {
          const shade = v === 100 ? 0 : 255;
          imgData.data.set([shade, shade, shade, 255], i * 4);
        });
        mapImage.current = await createImageBitmap(imgData);
        if (isLoading) {
          setIsLoading(false);
        }
        animationFrameId = requestAnimationFrame(draw);
      }, 200);

      let t = 0;
      let poseTimer = window.setInterval(() => {
        t += 0.05;
        const R = 10;
        robotPosition.current = {
          x: W / 2, //+ R * Math.cos(t),
          y: H / 2, //+ R * Math.sin(t),
          angle: t + Math.PI / 2,
        };
      }, 50);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.clearInterval(mapTimer);
        window.clearInterval(poseTimer);
      };
    }
  }, [rosContext?.state, useMock, isLoading, zoomFactor]);

  const updateZoomFactor = (event: React.WheelEvent<HTMLCanvasElement>) => {
    if (event.deltaY < 0) {
      if (zoomFactor.current >= 2) {
        zoomFactor.current = 2;
        return;
      }
      zoomFactor.current *= ZOOM_IN_FACTOR;
    } else {
      if (zoomFactor.current <= 1) {
        zoomFactor.current = 1;
        return;
      }
      zoomFactor.current *= ZOOM_OUT_FACTOR;
    }
  };

  return (
    <Box ref={containerRef} w={"100%"} h={"100%"}>
      {isLoading ? (
        <Skeleton h={"100%"} w={"100%"} />
      ) : (
        <canvas
          ref={mapRef}
          style={{
            imageRendering: "crisp-edges",
            backgroundColor: "white",
          }}
          onWheel={updateZoomFactor}
        />
      )}
    </Box>
  );
};

export default MapViewer;
