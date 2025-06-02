import { Box, Button, Flex, IconButton } from "@chakra-ui/react";
import React, { ReactNode } from "react";
import { AiFillHome } from "react-icons/ai";
import { FiMenu } from "react-icons/fi";
import NavItem from "../nav-item";
import { FaMapMarkedAlt } from "react-icons/fa";
import { IoSettingsSharp } from "react-icons/io5";
import { MdHome } from "react-icons/md";

type Props = {
  children: ReactNode;
};

const SubmenuAndContent = (props: Props) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Box as="section" bg="gray.50" _dark={{ bg: "gray.700" }} minH="100vh">
      <Box
        ml={{ base: 0, md: 80 }}
        transition=".3s ease"
        display={"flex"}
        flexDirection={"column"}
        height={"100vh"}
      >
        <Flex
          as="header"
          align="center"
          justify={{ base: "space-between", md: "end" }}
          w="full"
          px="4"
          bg="white"
          _dark={{ bg: "gray.800" }}
          borderBottomWidth="1px"
          color="inherit"
          h="14"
        >
          <IconButton
            aria-label="Menu"
            display={{ base: "inline-flex", md: "none" }}
            onClick={() => setOpen(true)}
            size="sm"
            _dark={{ bg: "gray.600" }}
          >
            <FiMenu />
          </IconButton>

          <Flex align="center">
            <NavItem icon={MdHome} path="/">
              Home
            </NavItem>
            <NavItem icon={FaMapMarkedAlt} path="/maps">
              Your maps
            </NavItem>
            <NavItem icon={IoSettingsSharp} path="/settings">
              Status
            </NavItem>
          </Flex>
        </Flex>

        <Box as="main" p="4" flex="1" overflow="auto">
          {props.children}
        </Box>
      </Box>
    </Box>
  );
};

export default SubmenuAndContent;
