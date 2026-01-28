// Under construction: subtle parallax on background for extra “alive” feel.
(function(){
  const bg = document.querySelector(".bg");
  if (!bg) return;

  let targetX = 0, targetY = 0;
  let curX = 0, curY = 0;

  function onMove(e){
    const x = (e.clientX / window.innerWidth) - 0.5;
    const y = (e.clientY / window.innerHeight) - 0.5;
    targetX = x * 10;
    targetY = y * 10;
  }

  function tick(){
    curX += (targetX - curX) * 0.06;
    curY += (targetY - curY) * 0.06;
    bg.style.transform = `translate3d(${curX}px, ${curY}px, 0)`;
    requestAnimationFrame(tick);
  }

  window.addEventListener("mousemove", onMove, { passive: true });
  tick();
})();
