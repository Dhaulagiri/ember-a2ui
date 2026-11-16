import { pageTitle } from 'ember-page-title';

<template>
  {{pageTitle "A2UI Explorer"}}

  <div class="app">
    <header class="app-header">
      <h1>A2UI Explorer</h1>
      <span class="muted">Ember renderer demo</span>
    </header>
    {{outlet}}
  </div>
</template>
