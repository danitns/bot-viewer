import React from "react";
import { Ros } from "roslib";

type RosContextType = {
  state: Ros | null;
  updateState: (newState: Ros) => void;
};

const RosContext = React.createContext<RosContextType | undefined>(undefined);

const RosContextProvider = ({ children }: any) => {
  const [state, setState] = React.useState<Ros | null>(null);

  const updateState = (newState: Ros) => {
    setState(newState);
  };

  const rosRef = React.useRef<Ros | null>(null);
  const retryInterval = React.useRef<NodeJS.Timeout | null>(null);

  const connectToRos = React.useCallback(() => {
    const ros = new Ros({
      url: "ws://localhost:9090",
    });

    ros.on("connection", () => {
      console.log("Connected to websocket server.");
      if (retryInterval.current) {
        clearInterval(retryInterval.current);
        retryInterval.current = null;
      }
      setState(ros);
    });

    ros.on("error", (error) => {
      console.log("Error connecting to websocket server: ", error);
    });

    ros.on("close", () => {
      console.log("Connection to websocket server closed.");
      if (!retryInterval.current) {
        retryInterval.current = setInterval(() => {
          console.log("Attempting to reconnect...");
          connectToRos();
        }, 10000);
      }
    });

    rosRef.current = ros;
  }, []);

  React.useEffect(() => {
    connectToRos();
    return () => {
      if (retryInterval.current) clearInterval(retryInterval.current);
      if (rosRef.current) rosRef.current.close();
    };
  }, [connectToRos]);

  return (
    <RosContext.Provider value={{ state, updateState }}>
      {children}
    </RosContext.Provider>
  );
};

export { RosContext, RosContextProvider };
