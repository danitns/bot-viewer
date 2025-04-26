import { Flex, Icon } from "@chakra-ui/react";
import React, { ReactNode } from "react";
import { Link as ReactRouterLink } from "react-router-dom";
import { useColorModeValue } from "../../ui/color-mode";

type Props = {
  icon: any;
  path: string;
  children: ReactNode;
  onClose?: () => void;
  rest?: any;
};

const NavItem = (props: Props) => {
  const color = useColorModeValue("gray.600", "gray.300");
  return (
    <ReactRouterLink to={props.path} onClick={props.onClose}>
      <Flex
        align="center"
        px="4"
        pl="4"
        py="3"
        cursor="pointer"
        color="inherit"
        _dark={{
          color: "gray.400",
        }}
        _hover={{
          bg: "gray.100",
          _dark: {
            bg: "gray.900",
          },
        }}
        role="group"
        fontWeight="semibold"
        transition=".15s ease"
        {...props.rest}
      >
        {props.icon && (
          <Icon
            mx="2"
            boxSize="4"
            _groupHover={{
              color: color,
            }}
            as={props.icon}
          />
        )}
        {props.children}
      </Flex>
    </ReactRouterLink>
  );
};

export default NavItem;
