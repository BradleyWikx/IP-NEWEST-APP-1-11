
import { useEffect, useRef } from 'react';

/**
 * useIframeResizer
 * Sends the current scrollHeight of the document to the parent window
 * via postMessage to enable seamless iframe height adjustment.
 */
export const useIframeResizer = (throttleMs: number = 100) => {
  const lastHeight = useRef<number>(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendHeight = () => {
    if (typeof window === 'undefined' || window.self === window.top) return;

    const height = document.documentElement.offsetHeight;
    
    // Only send if height changed to avoid unnecessary messages
    if (height !== lastHeight.current) {
      window.parent.postMessage({
        type: 'setHeight',
        height: height
      }, '*');
      lastHeight.current = height;
    }
  };

  const throttledSend = () => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      sendHeight();
      timer.current = null;
    }, throttleMs);
  };

  useEffect(() => {
    // Initial height
    sendHeight();

    // Listen for window resize
    window.addEventListener('resize', throttledSend);

    // Watch for DOM changes (wizard steps, content loading)
    const observer = new MutationObserver(throttledSend);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true
    });

    return () => {
      window.removeEventListener('resize', throttledSend);
      observer.disconnect();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
};

/**
 * Parent Listener Snippet (For Documentation)
 */
export const PARENT_LISTENER_SNIPPET = `
<script>
  window.addEventListener('message', function(e) {
    if (e.data.type === 'setHeight') {
      var iframe = document.getElementById('grand-stage-booking-frame');
      if (iframe) {
        iframe.style.height = e.data.height + 'px';
      }
    }
  }, false);
</script>
`;

export const IFRAME_SNIPPET = (origin: string) => `
<iframe 
  id="grand-stage-booking-frame"
  src="${origin}/#/" 
  style="width: 100%; border: none; overflow: hidden; transition: height 0.2s ease-out;"
  scrolling="no">
</iframe>
`;
