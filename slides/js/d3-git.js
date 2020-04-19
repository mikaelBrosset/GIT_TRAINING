/*!
 * Build Git graph/logs with D3.js
 * Inspired from "Interactive D3.js tree diagram":
 *  - http://jsfiddle.net/Lm4Qx/
 *  - http://bl.ocks.org/d3noob/8375092
 */
import d3 from 'd3'
import GitGraph from './d3-git/git-graph'

const graphs = {}

export function initializeD3GitGraph ({
  containerId = mandatory('containerId is missing'),
  jsonURL = mandatory('JSON URL is missing'),
  width = 1024, height = 500,
  viewBox
}) {
  if (graphs[containerId]) {
    console.warn(`A graph exists for container ID ${containerId}: skipping.`)
    return
  }

  // Load data from JSON : branches with commits, head, etc.
  d3.json(jsonURL, (error, data) => {
    if (error) throw error

    const { legend, comments, branches, steps, headless } = data

    const graph = new GitGraph({
      containerId, width, height, viewBox,
      legend, comments, branches, steps, headless
    })

    graph.draw()

    graphs[containerId] = graph
  })
}

export function getD3GitGraphByContainerId (id) {
  return graphs[id]
}

function mandatory (msg) {
  throw new Error(msg)
}
