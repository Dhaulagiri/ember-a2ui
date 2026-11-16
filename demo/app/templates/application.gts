import { pageTitle } from 'ember-page-title';
import { A2uiSurface } from 'ember-a2ui';

<template>
  {{pageTitle "Demo"}}

  <A2uiSurface />

  {{outlet}}
</template>
