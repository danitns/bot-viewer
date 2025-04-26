import {
  Box,
  Drawer,
  Portal,
  CloseButton,
  Flex,
  IconButton,
} from "@chakra-ui/react";
import React, { ReactNode } from "react";
import { FiMenu } from "react-icons/fi";
import SidebarContent from "../sidebar-content";

type Props = {
  children: ReactNode;
};

const SubmenuAndContent = (props: Props) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Box as="section" bg="gray.50" _dark={{ bg: "gray.700" }} minH="100vh">
      <SidebarContent
        inDrawer={false}
        display={{ base: "none", md: "unset" }}
      />
      <Drawer.Root
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
        placement={"start"}
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <SidebarContent
                inDrawer={true}
                w="full"
                borderRight="none"
                onClose={() => setOpen(false)}
              />
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
      <Box
        ml={{ base: 0, md: 60 }}
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
            {/* <Notifications />
            <Profile /> */}
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
