import { Box, Button, chakra, Flex, Heading, Stack } from "@chakra-ui/react";
import { UniversalWaypoint, OptimizedWaypoint } from "../../types/waypoint";
import React from "react";
import { PiMapPinFill } from "react-icons/pi";
import { ProcessStatus } from "../../hooks/useWebSocket";

type Props = {
  waypoints: Array<UniversalWaypoint>;
  optimizedWaypoints: Array<OptimizedWaypoint>;
  connectionStatus: string;
  processStatus: ProcessStatus;
  readyToSend: boolean;
  onSendWaypoints: () => void;
  onPrecompute: () => void;
  onStartNavigation: () => void;
};

const WaypointsPanel = (props: Props) => {
  return (
    <Stack p={3} fontSize={15}>
      <Heading color="inherit" _dark={{ color: "white" }}>
        Connection: {props.connectionStatus}
      </Heading>
      <Heading color="inherit" _dark={{ color: "white" }}>
        Process: {props.processStatus.message}
      </Heading>
      <Button onClick={props.onPrecompute}>Precompute graph</Button>

      {props.waypoints?.length >= 1 && (
        <Stack>
          <chakra.h2
            color="inherit"
            _dark={{
              color: "white",
            }}
          >
            Current waypoints:{" "}
          </chakra.h2>
          <Stack>
            {props.waypoints.map((waypoint, idx) => {
              return (
                <Box p={1} px={2} key={idx}>
                  <Flex flexDir={"row"} alignItems={"center"} gap={3}>
                    <PiMapPinFill color="white" />
                    <Box
                      color="inherit"
                      _dark={{
                        color: "white",
                      }}
                    >
                      {idx}: (x: {waypoint.canvasX} y: {waypoint.canvasY})
                    </Box>
                  </Flex>
                </Box>
              );
            })}
          </Stack>
          {props.readyToSend ? (
            <Button onClick={props.onSendWaypoints}>Send waypoints</Button>
          ) : (
            <Box _dark={{ color: "white" }}>
              Please precompute the graph before seding waypoints
            </Box>
          )}
        </Stack>
      )}

      {props.optimizedWaypoints?.length > 1 && (
        <Stack>
          <Stack>
            Optimized solution:
            {props.optimizedWaypoints.map((waypoint, index) => {
              return (
                <Box p={1} px={2} key={index}>
                  <Flex flexDir={"row"} alignItems={"center"} gap={3}>
                    <PiMapPinFill color="white" />
                    <Box
                      color="inherit"
                      _dark={{
                        color: "white",
                      }}
                    >
                      {waypoint.idx}: (x: {waypoint.x} y: {waypoint.x})
                    </Box>
                  </Flex>
                </Box>
              );
            })}
          </Stack>
          <Button onClick={props.onStartNavigation}>Start navigation</Button>
        </Stack>
      )}
    </Stack>
  );
};

export default WaypointsPanel;
