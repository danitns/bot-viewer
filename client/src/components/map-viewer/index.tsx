import React from "react";
import { RosContext } from "../../context/RosContext";
import { Topic } from "roslib";
import { Box, Skeleton, Flex, Button } from "@chakra-ui/react";

const MapViewer = () => {
  const ZOOM_IN_FACTOR = 1.1;
  const ZOOM_OUT_FACTOR = 0.9;
  const ROBOT_BASE_SIZE = 3;

  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  const [cursorPos, setCursorPos] = React.useState<{
    canvasX: number;
    canvasY: number;
    rosX: number;
    rosY: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  const [waypoints, setWaypoints] = React.useState<
    Array<{ canvasX: number; canvasY: number; rosX: number; rosY: number }>
  >([]);

  const waypointsRef = React.useRef<
    Array<{ canvasX: number; canvasY: number; rosX: number; rosY: number }>
  >([]);

  const rosContext = React.useContext(RosContext);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<HTMLCanvasElement>(null);
  const mapImage = React.useRef<ImageBitmap | null>(null);
  const mapParams = React.useRef<{
    width: number;
    height: number;
    resolution: number;
    origin: {
      x: number;
      y: number;
    };
  }>({
    width: 0,
    height: 0,
    resolution: 1,
    origin: { x: 0, y: 0 },
  });
  const mapData = React.useRef<number[]>([]);

  const robotPosition = React.useRef<{ x: number; y: number; angle: number }>({
    x: 0,
    y: 0,
    angle: 0,
  });

  const zoomFactor = React.useRef<number>(1);

  const useMock = !rosContext?.state;

  React.useEffect(() => {
    let animationFrameId: number;

    const drawRobot = (context: CanvasRenderingContext2D) => {
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
    };

    const drawWaypoint = (context: CanvasRenderingContext2D) => {
      waypointsRef.current.forEach((point, index) => {
        context.save();

        const yCoord = mapParams.current.height - point.canvasY;
        const radius = 0.5;

        // Draw the circle
        context.beginPath();
        context.fillStyle = "#00FF00"; // Green fill
        context.arc(point.canvasX, yCoord, radius, 0, 2 * Math.PI);
        context.fill();

        // Draw the number inside the circle
        context.fillStyle = "#000000"; // Black text
        context.font = "1px Arial";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText((index + 1).toString(), point.canvasX, yCoord);

        context.restore();
      });
    };

    const drawMap = (
      canvas: HTMLCanvasElement,
      context: CanvasRenderingContext2D
    ) => {
      const RW = mapParams.current.width;
      const RH = mapParams.current.height;

      const CW = containerRef.current!.clientWidth;
      const CH = containerRef.current!.clientHeight;

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
        mapImage.current!,
        0,
        0,
        mapParams.current.width,
        mapParams.current.height
      );
    };

    const draw = () => {
      if (!mapRef.current) return;

      const canvas = mapRef.current;
      const context = canvas.getContext("2d");

      if (!mapImage.current || !containerRef.current || !context) return;

      drawMap(canvas, context);
      drawRobot(context);
      drawWaypoint(context);

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
        mapParams.current = {
          width: info.width,
          height: info.height,
          resolution: info.resolution,
          origin: info.origin.position,
        };

        mapData.current = map.data;

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
          x:
            (-1 * mapParams.current.origin.x + position.x) /
            mapParams.current.resolution,
          y:
            (-1 * mapParams.current.origin.y + position.y) /
            mapParams.current.resolution,
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
        mapParams.current.width = W;
        mapParams.current.height = H;
        mapParams.current.resolution = 1;
        mapParams.current.origin = {
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

  React.useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);

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

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!containerRef.current || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const canvasWidth = mapRef.current.width;
    const canvasHeight = mapRef.current.height;

    const mapWidth = mapParams.current.width;
    const mapHeight = mapParams.current.height;
    const resolution = mapParams.current.resolution;
    const origin = mapParams.current.origin;

    const scale = Math.min(canvasWidth / mapWidth, canvasHeight / mapHeight);
    const totalScale = scale * zoomFactor.current;

    // Translate canvas coordinates back to map coordinates
    const mapX =
      (canvasX - (canvasWidth - mapWidth * totalScale) / 2) / totalScale;
    const mapY =
      (canvasY - (canvasHeight - mapHeight * totalScale) / 2) / totalScale; // Flip Y

    const rosX = mapX * resolution + origin.x;
    const rosY = mapY * resolution + origin.y;

    if (mapX >= 0 && mapX <= mapWidth && mapY >= 0 && mapY <= mapHeight) {
      setCursorPos({
        canvasX: Math.round(mapX),
        canvasY: Math.round(mapY),
        rosX: parseFloat(rosX.toFixed(2)),
        rosY: parseFloat(rosY.toFixed(2)),
        clientX: event.clientX,
        clientY: event.clientY,
      });
    } else {
      setCursorPos(null);
    }
  };

  const handleCanvasMouseClick = (
    event: React.MouseEvent<HTMLCanvasElement>
  ) => {
    const pointCoords = cursorPos;
    if (pointCoords) {
      setWaypoints([...waypoints, pointCoords]);
    }
  };

  const sendWaypoints = async () => {
    const payload = {
      info: mapParams.current,
      map: mapData.current,
      waypoints: waypoints.map((waypoint) => {
        return [waypoint.canvasY, waypoint.canvasX];
      }),
    };

    try {
      const response = await fetch("http://localhost:8000/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Response from server:", data);
    } catch (error) {
      console.error("Failed to send waypoints:", error);
    }
  };

  return (
    <Flex direction={"column"} h={"100%"}>
      {waypoints?.length > 1 && (
        <Flex>
          <Flex>
            {waypoints.map((waypoint, idx) => {
              return (
                <Box p={1} px={2}>
                  <div>
                    Canvas: {waypoint.canvasX} : {waypoint.canvasY}
                  </div>
                </Box>
              );
            })}
          </Flex>
          <Button onClick={sendWaypoints}>Send waypoints</Button>
        </Flex>
      )}
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
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setCursorPos(null)}
            onClick={handleCanvasMouseClick}
          />
        )}
        {cursorPos && (
          <Box
            position="absolute"
            left={`${cursorPos?.clientX + 10}px`}
            top={`${cursorPos?.clientY + 10}px`}
            p="2"
            bg="white"
            color="black"
            borderRadius="md"
            boxShadow="md"
            fontSize="sm"
          >
            <div>
              Canvas: ({cursorPos?.canvasX}, {cursorPos?.canvasY})
            </div>
            <div>
              ROS: ({cursorPos?.rosX}, {cursorPos?.rosY})
            </div>
          </Box>
        )}
      </Box>
    </Flex>
  );
};

export default MapViewer;
