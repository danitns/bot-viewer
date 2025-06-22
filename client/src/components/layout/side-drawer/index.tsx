import SidebarContent from "../sidebar-content";
import { Drawer, Portal, CloseButton } from "@chakra-ui/react";
import React, { ReactNode } from "react";

type Props = {
  open: boolean;
  setOpen: (arg: boolean) => void;
  children?: ReactNode;
  w?: string;
};

const SideDrawer = (props: Props) => {
  return (
    <>
      <SidebarContent
        inDrawer={false}
        display={{ base: "none", md: "unset" }}
        children={props.children}
        {...(props.w ? { w: props.w } : {})}
      />
      <Drawer.Root
        open={props.open}
        onOpenChange={(e) => props.setOpen(e.open)}
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
                onClose={() => props.setOpen(false)}
                children={props.children}
              />
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </>
  );
};

export default SideDrawer;
