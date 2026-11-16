import type A2uiSurface from './components/a2ui-surface';
import type A2uiSurfaces from './components/a2ui-surfaces';
import type A2uiNode from './components/a2ui-node';

export default interface Registry {
  A2uiSurface: typeof A2uiSurface;
  A2uiSurfaces: typeof A2uiSurfaces;
  A2uiNode: typeof A2uiNode;
}
