import s_cabin_booking from './cabin-booking';
import s_component_gallery from './component-gallery';
import s_scaffold_simple_text from './scaffold-simple-text';
import s_scaffold_row_layout from './scaffold-row-layout';
import s_scaffold_simple_login_form from './scaffold-simple-login-form';
import s_advanced_form_validator from './advanced-form-validator';
import s_live_invitation_builder from './live-invitation-builder';
import s_music_player from './music-player';
import s_child_list_template from './child-list-template';
import s_recipe_card from './recipe-card';
import s_modal from './modal';
import s_v0_9_scaffold_simple_login_form from './v0-9-scaffold-simple-login-form';
import s_v0_9_scaffold_simple_text from './v0-9-scaffold-simple-text';
import type { Sample } from './types';

export type { ActionLike, ProtocolVersion, Sample } from './types';

export const SAMPLES: Sample[] = [
  s_cabin_booking,
  s_component_gallery,
  s_scaffold_simple_text,
  s_scaffold_row_layout,
  s_scaffold_simple_login_form,
  s_advanced_form_validator,
  s_live_invitation_builder,
  s_music_player,
  s_child_list_template,
  s_recipe_card,
  s_modal,
  s_v0_9_scaffold_simple_login_form,
  s_v0_9_scaffold_simple_text,
];

export const GROUPS: Sample['group'][] = ['Showcase', 'Basic catalog', 'v0.9'];

export function findSample(id: string | undefined): Sample {
  return SAMPLES.find((s) => s.id === id) ?? (SAMPLES[0] as Sample);
}
