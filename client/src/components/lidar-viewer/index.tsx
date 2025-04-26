import React from "react";
import { Ros, Topic } from "roslib";

const polarToCartesian = (range: number, angle: number) => {
  return {
    x: range * Math.cos(angle),
    y: range * Math.sin(angle),
  };
};

const convertLidarData = (
  ranges: Array<number>,
  angle_min: number,
  angle_max: number
) => {
  const angle_increment = (angle_max - angle_min) / ranges.length;
  let points = [];

  for (let i = 0; i < ranges.length; i++) {
    const angle = angle_min + i * angle_increment;
    if (ranges[i] > 0) {
      points.push(polarToCartesian(ranges[i], angle));
    }
  }

  return points;
};

const LidarViewer = () => {
  const angleMin = -3.14;
  const angleMax = 3.14;
  const [lidarData, setLidarData] = React.useState({});

  const canvasRef = React.useRef({} as HTMLCanvasElement);

  React.useEffect(() => {
    const ros = new Ros({
      url: "ws://localhost:9090",
    });

    ros.on("connection", () => {
      console.log("Connected to websocket server.");
    });

    ros.on("error", (error) => {
      console.log("Error connecting to websocket server: ", error);
    });

    ros.on("close", () => {
      console.log("Connection to websocket server closed.");
    });

    const topic = new Topic({
      ros,
      name: "/scan",
      messageType: "sensor_msgs/LaserScan",
    });

    topic.subscribe((message) => {
      console.log("Message received on /scan: ", message as any);
      const messageAny = message as any;
      const ranges = messageAny.ranges;
      const points = convertLidarData(ranges, angleMin, angleMax);
      const canvas = canvasRef!.current;
      const ctx = canvas.getContext("2d");

      if (ctx !== null) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.translate(canvas.width / 2, canvas.height / 2);

        points.forEach((point) => {
          const x = point.x * 100;
          const y = point.y * 100;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, 2 * Math.PI);
          ctx.fillStyle = "black";
          ctx.fill();
        });

        ctx.resetTransform();
        setLidarData(message);
      }
    });

    return () => {
      topic.unsubscribe();
    };
  }, []);

  return (
    <div>
      <h1>ROS2 Data Viewer</h1>
      <pre>
        {lidarData ? (
          <canvas
            ref={canvasRef}
            width={1000}
            height={900}
            style={{ border: "1px solid black" }}
          ></canvas>
        ) : (
          "No data received yet"
        )}
      </pre>
    </div>
  );
};

export default LidarViewer;
