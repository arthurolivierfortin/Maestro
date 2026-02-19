import { useScroll } from './useScroll.ts';
import { useEffect } from 'react';

export function useSinglePanelScroll(contentHeight: number, panelHeight: number) {
  const { getOffset, scrollUp, scrollDown, scrollTo, setMaxScroll } = useScroll();
  const panel = '_single';
  const maxScroll = Math.max(0, contentHeight - panelHeight);

  useEffect(() => {
    setMaxScroll(panel, maxScroll);
  }, [contentHeight, panelHeight, setMaxScroll, maxScroll]);

  const offset = getOffset(panel);

  return {
    offset,
    scrollUp: () => scrollUp(panel),
    scrollDown: () => scrollDown(panel),
    scrollToTop: () => scrollTo(panel, 0),
    scrollToBottom: () => scrollTo(panel, maxScroll),
    canScrollUp: offset > 0,
    canScrollDown: offset < maxScroll,
  };
}
