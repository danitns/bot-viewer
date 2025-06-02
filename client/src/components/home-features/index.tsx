import { Box, Button, chakra, Flex, Stack } from "@chakra-ui/react";
import React from "react";
import Feature from "./feature";
import { LuGlobe } from "react-icons/lu";
import { FiMap, FiSend } from "react-icons/fi";
import { LuSpline } from "react-icons/lu";
import Spline from "@splinetool/react-spline";
import { Link as ReactRouterLink } from "react-router-dom";

type Props = {};

const HomeFeatures = (props: Props) => {
  const [isLoaded, setIsLoaded] = React.useState<boolean>(false);

  const onLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div
      style={{
        backgroundColor: "black",
        height: "100%",
      }}
    >
      <Spline
        scene="https://prod.spline.design/6NBZRNhyCh37GIaP/scene.splinecode"
        onLoad={onLoad}
      />
      <Box
        position={"absolute"}
        left={0}
        top={"0"}
        h={"100%"}
        w={"100%"}
        opacity={isLoaded ? 1 : 0}
        transition={"all 5.0s ease-in-out"}
        pointerEvents={isLoaded ? "auto" : "none"}
      >
        <Flex
          flexDir={"row"}
          justifyContent={"space-between"}
          alignItems={"center"}
          h={"100%"}
          px={"75px"}
        >
          <Box textAlign={{ lg: "center" }} maxW={"700px"}>
            <chakra.h2
              _light={{ color: "brand.600" }}
              fontWeight="semibold"
              textTransform="uppercase"
              letterSpacing="wide"
            >
              PathViz
            </chakra.h2>
            <chakra.p
              mt={2}
              fontSize={{ base: "3xl", sm: "4xl" }}
              lineHeight="4"
              fontWeight="extrabold"
              letterSpacing="tight"
              _light={{ color: "gray.900" }}
            >
              Visualize & Control ROS 2 Navigation
            </chakra.p>
            <chakra.p
              mt={2}
              mb={4}
              maxW="2xl"
              fontSize="xl"
              mx={{ lg: "auto" }}
              color="gray.500"
              _dark={{ color: "gray.400" }}
            >
              PathViz offers an interactive interface to display robot maps,
              plan complex Reeds-Shepp paths with forward and reverse motions,
              manage multiple waypoints, and seamlessly send Nav2 commands.
            </chakra.p>
            <ReactRouterLink to={"/maps"}>
              <Button size={"xl"}>View map</Button>
            </ReactRouterLink>
          </Box>
          <Box maxW={"700px"}>
            <Stack>
              <Feature title="Interactive Map Visualization" icon={LuGlobe}>
                Explore detailed, real-time map views of your robot's
                environment. PathViz supports layering of occupancy grids,
                costmaps, and live sensor data for full situational awareness.
              </Feature>

              <Feature title="Multi-Waypoint Sequencing" icon={FiMap}>
                Define and reorder an arbitrary list of waypoints through the
                UI. PathViz intelligently optimizes waypoint order and adapts to
                dynamic updates on the fly.
              </Feature>

              <Feature title="Path Planning" icon={LuSpline}>
                Compute smooth, curvature-constrained trajectories—including
                forward and backward motions—using a modified Dubins TSP solver
                tailored for Ackermann robots.
              </Feature>

              <Feature title="Nav2 Command Interface" icon={FiSend}>
                Send selected paths or waypoint goals directly to Nav2. Monitor
                command status, receive feedback, and adjust parameters such as
                speeds and tolerances in real time.
              </Feature>
            </Stack>
          </Box>
        </Flex>
      </Box>

      {/* <Flex
        bg="#edf3f8"
        _dark={{ bg: "#3e3e3e" }}
        p={20}
        w="auto"
        justifyContent="center"
        alignItems="center"
      >
        <Box py={12} bg="white" _dark={{ bg: "gray.800" }} rounded="xl">
          <Box maxW="7xl" mx="auto" px={{ base: 4, lg: 8 }}>
            <Box textAlign={{ lg: "center" }}>
              <chakra.h2
                _light={{ color: "brand.600" }}
                fontWeight="semibold"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                PathViz
              </chakra.h2>
              <chakra.p
                mt={2}
                fontSize={{ base: "3xl", sm: "4xl" }}
                lineHeight="4"
                fontWeight="extrabold"
                letterSpacing="tight"
                _light={{ color: "gray.900" }}
              >
                Visualize & Control ROS 2 Navigation
              </chakra.p>
              <chakra.p
                mt={4}
                maxW="2xl"
                fontSize="xl"
                mx={{ lg: "auto" }}
                color="gray.500"
                _dark={{ color: "gray.400" }}
              >
                PathViz offers an interactive interface to display robot maps,
                plan complex Reeds-Shepp paths with forward and reverse motions,
                manage multiple waypoints, and seamlessly send Nav2 commands.
              </chakra.p>
            </Box>

            <Box mt={10}>
              <Stack
                //spacing={{ base: 10, md: 0 }}
                display={{ md: "grid" }}
                gridTemplateColumns={{ md: "repeat(2,1fr)" }}
                gridColumnGap={{ md: 8 }}
                gridRowGap={{ md: 10 }}
              >
                <Feature title="Interactive Map Visualization" icon={LuGlobe}>
                  Explore detailed, real-time map views of your robot's
                  environment. PathViz supports layering of occupancy grids,
                  costmaps, and live sensor data for full situational awareness.
                </Feature>

                <Feature title="Multi-Waypoint Sequencing" icon={FiMap}>
                  Define and reorder an arbitrary list of waypoints through the
                  UI. PathViz intelligently optimizes waypoint order and adapts
                  to dynamic updates on the fly.
                </Feature>

                <Feature title="Path Planning" icon={LuSpline}>
                  Compute smooth, curvature-constrained trajectories—including
                  forward and backward motions—using a modified Dubins TSP
                  solver tailored for differential-drive robots.
                </Feature>

                <Feature title="Nav2 Command Interface" icon={FiSend}>
                  Send selected paths or waypoint goals directly to Nav2.
                  Monitor command status, receive feedback, and adjust
                  parameters such as speeds and tolerances in real time.
                </Feature>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Flex> */}
    </div>
  );
};

export default HomeFeatures;
