/*!
 * Build Git graph/logs with D3.js
 * Inspired from "Interactive D3.js tree diagram":
 *  - http://jsfiddle.net/Lm4Qx/
 *  - http://bl.ocks.org/d3noob/8375092
 *
 * TODO :
 *  - naming: 'origin' should be 'startPoint' pretty much everywhere
 *  - monospace fonts, at least for SHAs and HEAD
 *  - Promise-based chaining instead of 'callback: () =>` snippets
 *  - Rewind step by step?
 *  - detached head
 *  - tags
 *  - orientation : vertical / horizontal
 *  - commit display mode : rectangle / circle
 *
 * IDEAS :
 *  - manage states history using Redux
 *  - Manage width from max branch commit number in order
 *    to get the whole thing centered
 */

import d3 from 'd3'
import Branch from './git-branch'
import { MergeCommit } from './git-block'

const X_GAP = 40
const Y_GAP = 30
const BLOCK_WIDTH = 90
const BLOCK_HEIGHT = 50
const TEXT_HEIGHT = 30
const PADDING = 20
const MIN_WIDTH = 960

/**
 * Main container for a git graph
 */
export class GitGraph {

  constructor ({
    containerId, legend, comments, branches, steps = [], headless = false,
    width = 1024, height = 500, viewBox = null // SVG container dimensions
  }) {
    this.id = `${containerId}-graph`
    this.xGap = X_GAP
    this.yGap = Y_GAP
    this.legend = legend
    this.comments = comments
    this.blockHeight = BLOCK_HEIGHT
    this.blockWidth = BLOCK_WIDTH
    this.steps = steps
    this.headless = !!headless
    this.lastStepIndex = 0
    this.y = legend
      ? (comments ? 2 * TEXT_HEIGHT + PADDING : this.blockHeight + this.yGap)
      : 0

    this.setupContainer({ containerId, width, height, viewBox })

    // Register branches
    this.branches = []
    branches.forEach((branch) => this.addBranch(branch))

    this.initialState = { branches, legend, comments }
  }

  /**
   * Add a new branch
   * @param {Object} branch – branch descriptor
   */
  addBranch (branch) {
    let origin = null
    if (branch.origin) {
      origin = this.findBranch(branch.origin)
    }
    // FIXME: WHY!!?!
    if (!origin) {
      origin = this.branches[this.branches.length - 1]
    }
    const br = new Branch({
      graph: this,
      origin: origin,
      label: branch.name.value,
      commits: branch.commits,
      branchTag: branch.name.position,
      headTag: branch.head,
      startAt: branch.startAt,
      tagPosition: branch.tagPosition
    })
    this.branches.push(br)
    this.detachCommits({ branch: branch.name.value, commits: branch.detachedCommits })

    // Set global headTag
    if (br.headTag) {
      this.headTag = br.headTag
    }

    return br
  }

  /**
   * Manage text (labels) animations (ease in / out).
   * @param  {D3.Selection} options.text
   * @param  {Boolean} options.easeOut do we have to ease out previous legend?
   * @param  {Number} options.duration animation/transition duration
   * @param  {Function} options.callback
   */
  animateText ({ d3Text, text, yStart, animation = 'easeIn', duration = 500, callback }) {
    if (animation === 'easeOut') {
      d3Text.transition().duration(duration)
        .attr('y', yStart - 2 * this.blockHeight)
        .style('opacity', 0)
        .each('end', () => { this.animateText({ d3Text, text, yStart, animation: 'easeIn', duration, callback }) })
    } else if (animation === 'easeIn') {
      d3Text
        .text(text)
        .attr('y', yStart + 2 * this.blockHeight)
        .transition()
        .duration(duration)
        .style('opacity', 1)
        .attr('y', yStart + this.blockHeight / 2)
        .each('end', () => { callback && setTimeout(callback, duration) })
    } else if (animation === 'fadeOut') {
      d3Text.transition().duration(duration)
        .style('opacity', 0)
        .each('end', () => { this.animateText({ d3Text, text, yStart, animation: 'fadeIn', duration, callback }) })
    } else if (animation === 'fadeIn') {
      d3Text
        .text(text)
        .transition()
        .duration(duration)
        .style('opacity', 1)
        .each('end', () => { callback && setTimeout(callback, duration) })
    }
  }

  /**
   * Draw the whole graph
   */
  draw () {
    this.drawLegend({ callback: () => {
      this.branches.forEach((branch) => branch.draw())
    }})
  }

  /**
   * Draw graph comments
   * @param  {Function} callback – the method to call when legend is drawn
   * @param  {Boolean}  animate  – do we animate drawing or not?
   */
  drawComments ({ callback, animations = {} }) {
    this.drawText({
      text: this.comments || ' ',
      selector: 'comments',
      yPos: TEXT_HEIGHT,
      callback,
      animations: { ...animations, yStart: this.legend ? TEXT_HEIGHT : 0 }
    })
  }

  /**
   * Draw graph legend
   * @param  {Function} callback – the method to call when legend is drawn
   * @param  {Boolean}  animate  – do we animate drawing or not?
   */
  drawLegend ({ callback, animations = { in: 'easeIn', out: 'easeOut' } }) {
    this.drawText({
      text: this.legend,
      selector: 'legend',
      yPos: TEXT_HEIGHT / 2,
      callback,
      animations: { ...animations, yStart: 0 }
    })
    this.drawComments({ animations: { in: 'easeIn', out: 'easeOut' } })
  }

  /**
   * Draw text on graph
   * Callbacks are triggered on transitions
   * Transitions events are called using `each` method (there is no `on` method)
   * See [documentation](https://github.com/d3/d3/wiki/Transitions#control)
   * @param  {String} options.text     The text to display/draw
   * @param  {String} options.selector CSS selector in SVG graph
   * @param  {Number} options.xPos     The absissa/x position where to draw
   * @param  {Number} options.yPos     The ordinate/y position where to draw
   * @param  {Function} callback       the method to call when legend is drawn
   * @param  {Object} animations       which animation to play when drawing
   */
  drawText ({ text, selector, xPos = 0, yPos, callback = () => {}, animations }) {
    if (!text) {
      return callback()
    }

    let d3Text = this.container.select(`#${selector}`)

    if (!d3Text.empty()) {
      if (animations) {
        this.animateText({ d3Text, text, yStart: animations.yStart, animation: animations.out, callback })
      } else {
        d3Text.text(text)
        callback()
      }
    } else {
      d3Text = this.container.append('text')
        .text(text)
        .attr('id', selector)
        .attr('class', selector)
        .attr('x', xPos)
        .attr('y', yPos)

      if (animations) {
        this.animateText({ d3Text, text, yStart: animations.yStart, animation: animations.in, callback })
        callback()
      }
    }
  }

  /**
   * Find a specific branch from its label
   * @param  {String} label – the branch name
   * @return {Branch}       – the branch (or null if not found)
   */
  findBranch (label) {
    const br = this.branches.find((branch) => branch.label === label)
    if (!br) {
      throw new Error(`Cannot find branch <${label}>`)
    }
    return br
  }

  /**
   * Process next step: parse given commands
   * with parameters from JSON.
   * A step can
   *   * override graph legend
   *   * define many commands to be displayed
   *
   * Example:
   *
   * "steps": [
   *   {
   *      "legend": "Add a new commit on master: git add … + git commit",
   *      "actions": [
   *        {
   *          "method": "addCommits",
   *          "commits": ["abcd12"],
   *          "branch": "master"
   *        }
   *      ]
   *    }
   *  ]
   */
  nextStep () {
    const step = this.steps[this.lastStepIndex]
    if (!step) {
      return
    }

    if (step.legend) {
      this.legend = step.legend
      this.comments = step.comments
      this.drawLegend({ callback: () => this.processActions(step.actions) })
    } else {
      this.processActions(step.actions)
    }

    this.lastStepIndex += 1
  }

  /**
   * Reset graph
   */
  reset () {
    this.container.selectAll('*').remove()
    this.branches = []
    this.initialState.branches.forEach((branch) => this.addBranch(branch))
    this.legend = this.initialState.legend
    this.comments = this.initialState.comments
    this.lastStepIndex = 0
    this.draw()
  }

  /**
   * Process any existing action
   * @param  {Object} actions – actions to be processed
   *
   * Call actions with its parameters on current graph.
   * Actions are read from JSON and are flattened with their parameters.
   * We expect called method to manage parameters as a map/named parameters.
   *
   * Example:
   *
   * "actions": [
   *   {
   *     "method": "addCommits", // The method we want to call
   *     "commits": ["abcd12"],  // 'commits' parameter
   *     "branch": "master"      // 'branch' parameter
   *   }
   * ]
   */
  processActions (actions) {
    actions.forEach((action) => {
      const { method } = action
      if (typeof this[method] !== 'function') {
        throw new Error(`Unknown method ${method} for ${this.constructor.name}`)
      }
      this[method](action)
    })
  }

  /*     ACTIONS     */

  /**
   * Add CSS class to given commit and redraw commit
   * @param {String} options.branch label of the branch where to look for the commit
   * @param {String} options.commit label of the commit
   * @param {String} options.className  the class to add
   */
  addClassToCommit ({ branch, commit, className }) {
    const br = this.findBranch(branch)
    const co = br.findCommit(commit)
    co.addClass(className).draw()
  }

  /**
   * Manage new commits to add to a specific branch
   * @param {String} options.branch – branch where to put new commits
   * @param {Array} options.commits – commits (as strings) to add to target branch
   */
  addCommits ({ branch, commits }) {
    const br = this.findBranch(branch)
    commits.forEach((commitLabel) => br.addCommit(commitLabel).draw())
  }

  /**
   * Update commits that were initially detached from branch
   * @param  {String} options.branch - the branch we want to move
   * @param  {Array} commits - commits to be detached
   */
  attachCommits ({ branch, commits = [] }) {
    const source = this.findBranch(branch)
    commits.forEach((label) => {
      const commit = source.findCommit(label)
      if (commit) {
        commit.attach()
      }
    })
  }

  /**
   * Display commits as detached from branch/graph
   * @param  {String} options.branch - the branch we want to move
   * @param  {Array} commits - commits to be detached
   */
  detachCommits ({ branch, commits = [] }) {
    const source = this.findBranch(branch)
    commits.forEach((label) => {
      const commit = source.findCommit(label)
      if (commit) {
        commit.detach()
      }
    })
  }

  /**
   * Add a merge commit:
   * add dedicated commit to source branch then draw it.
   * @param  {String} options.label  commit label
   * @param  {Map} options.source source branch and commit
   * @param  {Map} options.target targeted branch and commit (the one we merge)
   */
  merge ({ label, source, target }) {
    [source, target] = [source, target].map(
      ({ branch, commit }) => this.findBranch(branch).findCommit(commit)
    )
    const commit = new MergeCommit({ label, source, target })
    source.branch.commits.push(commit)
    commit.draw()
  }

  /**
   * Move branch to another starting point (target)
   * @param  {String} options.branch - the branch we want to move
   * @param  {Map} options.target – expected keys are `branch` and `commit` (where to start)
   */
  moveBranch ({ branch, target }) {
    this.findBranch(branch).move(target)
  }

  /**
   * Move branch tag to another origin/position:
   * process attributes update, then move SVG block
   * @param  {String} options.branch the targeted branch
   * @param  {String} options.target the targeted commit
   * @param  {String} options.tagPosition force/override position
   */
  moveBranchTag ({ branch, target, targetBranch, tagPosition = null }) {
    const source = this.findBranch(branch)
    const origin = targetBranch
      ? this.findBranch(targetBranch).findCommit(target)
      : source.findCommit(target)
    source.branchTag.refresh(origin, tagPosition).move()
  }

  /**
   * Move head tag to another branch/position:
   * process attributes update, then move SVG block
   * @param  {String} options.branch the targeted branch
   * @param  {String} options.target the targeted commit
   * @param  {String} options.tagPosition force/override position
   */
  moveHeadTag ({ branch, target = null, tagPosition = null }) {
    const source = this.findBranch(branch)
    // Update current branch if changed
    if (this.headTag.branch !== source) {
      source.headTag = this.headTag
      this.headTag.branch = source
    }
    const origin = target ? source.findCommit(target) : source.branchTag
    this.headTag.refresh(origin, tagPosition).move()
  }

  /**
   * Remove branch tag
   * @param  {String} branch [description]
   */
  removeBranchTag ({ branch }) {
    this.findBranch(branch).branchTag.remove()
  }

  /**
   * Remove commits from branch/graph
   * @param  {String} options.branch - the branch we want to move
   * @param  {Array} commits - commits to be detached
   */
  removeCommits ({ branch, commits = [] }) {
    const source = this.findBranch(branch)
    source.removeCommits(commits)
  }

  /**
   * Update branch name
   * @param  {String} options.branch branch label
   * @param  {String} options.label  new label
   */
  renameBranchTag ({ branch, label }) {
    const source = this.findBranch(branch)
    source.label = label
    source.branchTag.label = label
    source.branchTag.draw()
  }

  /**
   * Set branch tag (no commits)
   * @param {Map} options.branch branch attributes
   */
  setBranch ({ branch }) {
    this.addBranch(branch).draw()
  }

  setupContainer ({ containerId, width, height, viewBox }) {
    const mainContainer = d3.select(`#${containerId}`).append('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('version', '1.1')
      .attr('viewBox', viewBox || `0 0 ${width * 1.2} ${height * 1.2}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('width', Math.min(width + 2 * PADDING, MIN_WIDTH))
      .attr('height', height + 2 * PADDING)
      .attr('id', this.id)

    this.container = mainContainer.append('g')
      .attr('transform', `translate(${PADDING},${PADDING})`)

    if (this.steps.length) {
      // Manage steps control when clicking on SVG
      mainContainer.on('click', () => this.nextStep())
    }
  }
}

export default GitGraph
