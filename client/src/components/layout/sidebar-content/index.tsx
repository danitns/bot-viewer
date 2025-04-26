import { Box, Flex, Image, Text } from "@chakra-ui/react";
import NavItem from "../nav-item";
import { FaMapMarkedAlt } from "react-icons/fa";
import { MdHome } from "react-icons/md";
import { IoSettingsSharp } from "react-icons/io5";
import React from "react";
import logo from "../../../assets/logo.png";

type Props = {
  onClose?: () => void;
  borderRight?: string;
  display?: any;
  w?: any;
  inDrawer: boolean;
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
      w="60"
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
          RoboCOP
        </Text>
      </Flex>
      <Flex
        direction="column"
        as="nav"
        fontSize="sm"
        color="gray.600"
        aria-label="Main Navigation"
      >
        <NavItem icon={MdHome} path="/" onClose={props.onClose}>
          Home
        </NavItem>
        <NavItem icon={FaMapMarkedAlt} path="/maps" onClose={props.onClose}>
          Your maps
        </NavItem>
        <NavItem
          icon={IoSettingsSharp}
          path="/settings"
          onClose={props.onClose}
        >
          Status
        </NavItem>
      </Flex>
    </Box>
  );
};

export default SidebarContent;
