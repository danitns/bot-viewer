import { Box, Flex, Image, Text } from "@chakra-ui/react";
import React, { ReactNode } from "react";
import logo from "../../../assets/logo.png";

type Props = {
  onClose?: () => void;
  borderRight?: string;
  display?: any;
  w?: any;
  inDrawer: boolean;
  children: ReactNode;
};

const SidebarContent = (props: Props) => {
  return (
    <Box
      as="nav"
      pos={props.inDrawer ? "relative" : "fixed"}
      top="0"
      left="0"
      zIndex="sticky"
      h="full"
      pb="10"
      overflowX="hidden"
      overflowY="auto"
      bg="white"
      _dark={{
        bg: "gray.800",
        borderColor: "gray.900",
      }}
      color="inherit"
      borderRightWidth="1px"
      w="80"
      {...props}
    >
      <Flex px="4" py="5" align="center">
        <Image src={logo} w={"70px"} />
        <Text
          fontSize="2xl"
          ml="2"
          color="brand.500"
          _dark={{
            color: "white",
          }}
          fontWeight="semibold"
        >
          PathViz
        </Text>
      </Flex>
      <Flex
        direction="column"
        as="nav"
        fontSize="sm"
        color="gray.600"
        aria-label="Main Navigation"
      >
        {props.children}
      </Flex>
    </Box>
  );
};

export default SidebarContent;
