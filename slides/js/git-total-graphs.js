import Combokeys from 'combokeys'
import { initializeD3GitGraph, getD3GitGraphByContainerId } from './d3-git'

const list = [...document.getElementsByClassName('git-graph')]
const combokeys = new Combokeys(document.documentElement)

/* globals Reveal */

function getCurrentGraph () {
  const slide = Reveal.getCurrentSlide()
  const graphId = slide.querySelector('.git-graph').id
  return getD3GitGraphByContainerId(graphId)
}

list.forEach((graph) => {
  const jsonURL = graph.getAttribute('data-src')

  if (jsonURL) {
    const height = graph.getAttribute('data-height')
    const width = graph.getAttribute('data-width')
    const viewBox = graph.getAttribute('data-viewBox')

    initializeD3GitGraph({
      jsonURL: `js/graphs/${jsonURL}`,
      containerId: graph.id,
      height: height ? Number(height) : undefined,
      width: width ? Number(width) : undefined,
      viewBox: viewBox || undefined
    })
  }
})

combokeys.bind('>', () => {
  getCurrentGraph().nextStep()
  return false
})

combokeys.bind('<', () => {
  getCurrentGraph().reset()
  return false
})
