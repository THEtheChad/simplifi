"use strict";

const version = /\d+\.\d+\.\d+/.exec(process.version);
const node = version[0];
module.exports = {
  plugins: ['@babel/plugin-proposal-class-properties'],
  presets: [['@babel/preset-env', {
    targets: {
      node
    }
  }]]
};