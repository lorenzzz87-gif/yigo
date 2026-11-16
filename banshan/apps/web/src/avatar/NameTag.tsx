import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, LinearFilter, SRGBColorSpace, Vector3, type Sprite } from 'three';
import { INK } from '../scene/palette';

/** 离镜头超过这么远就不显示名字，画面安静些，也省 draw call */
const VISIBLE_WITHIN_M = 14;
const W = 320;
const H = 72;

function drawName(name: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `36px "Noto Serif SC", "Songti SC", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(237, 232, 221, 0.9)';
  ctx.strokeText(name, W / 2, H / 2);
  ctx.fillStyle = INK.jiaomo;
  ctx.fillText(name, W / 2, H / 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** 头顶的名字：一张始终朝向镜头的小字。所有人共用一个模型，靠名字区分（§3）。 */
export function NameTag({ source, y }: { source: { name: string }; y: number }) {
  const ref = useRef<Sprite>(null);
  const shown = useRef(source.name);
  const world = useMemo(() => new Vector3(), []);
  const texture = useMemo(() => drawName(source.name), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ camera }) => {
    const sprite = ref.current;
    if (!sprite) return;
    if (source.name !== shown.current) {
      // 换了名字：重画同一张贴图
      shown.current = source.name;
      const fresh = drawName(source.name);
      texture.image = fresh.image;
      texture.needsUpdate = true;
    }
    sprite.visible = sprite.getWorldPosition(world).distanceTo(camera.position) < VISIBLE_WITHIN_M;
  });

  return (
    <sprite ref={ref} position={[0, y, 0]} scale={[0.84, 0.19, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}
