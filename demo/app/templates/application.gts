import { pageTitle } from 'ember-page-title';
import AppHeader from '../components/app-header';

<template>
  {{pageTitle "ember-a2ui · A2UI Explorer"}}

  <div class="app">
    <AppHeader />
    {{outlet}}
  </div>
</template>
