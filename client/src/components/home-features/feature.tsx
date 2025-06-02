import { Box, chakra, Flex, Icon } from "@chakra-ui/react";
import React, { ReactNode } from "react";

type Props = {
  icon: any;
  title: string;
  children: ReactNode;
};

const Feature = (props: Props) => {
  return (
    <Flex mt={10}>
      <Flex shrink={0}>
        <Flex
          alignItems="center"
          justifyContent="center"
          h={12}
          w={12}
          rounded="md"
          _light={{ bg: "#246355" }}
          color="white"
          marginTop={"35px"}
        >
          <Icon
            boxSize={6}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
            as={props.icon}
          ></Icon>
        </Flex>
      </Flex>
      <Box ml={4}>
        <chakra.dt
          fontSize="lg"
          fontWeight="medium"
          _light={{ color: "gray.900" }}
        >
          {props.title}
        </chakra.dt>
        <chakra.dd mt={1} color="gray.500" _dark={{ color: "gray.400" }}>
          {props.children}
        </chakra.dd>
      </Box>
    </Flex>
  );
};

export default Feature;
