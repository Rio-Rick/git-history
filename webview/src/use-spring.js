// based on https://github.com/streamich/react-use/blob/master/src/useSpring.ts
import { SpringSystem } from "rebound";
import { useState, useEffect } from "react";

export default function useSpring({
  target = 0,
  current = null,
  tension = 0,
  friction = 10,
  round = x => x
}) {
  const [spring, setSpring] = useState(null);
  const [value, setValue] = useState(target);

  useEffect(() => {
    const listener = {
      onSpringUpdate: spring => {
        const value = spring.getCurrentValue();
        setValue(round(value));
      }
    };

    const newSpring = new SpringSystem().createSpring(tension, friction);
    newSpring.setCurrentValue(target);
    newSpring.addListener(listener);
    setSpring(newSpring);

    // stop the spring when the component goes away (before it was left
    // running and updating a component that was not there anymore)
    return () => {
      newSpring.removeListener(listener);
      newSpring.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tension, friction]);

  useEffect(() => {
    if (spring) {
      spring.setEndValue(target);
      if (current != null) {
        spring.setCurrentValue(current);
      }
    }
  }, [target, current]);

  return value;
}
