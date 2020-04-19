import d3 from 'd3'

// Used for line drawing between blocks
const diagonal = d3.svg.diagonal()
  .source(({ source: { x, y } }) => ({ x: y, y: x }))
  .target(({ target: { x, y } }) => ({ x: y, y: x }))
  .projection(({ y, x }) => [y, x])

const CORNER_RADIUS = 15
const MAX_LABEL_LENGTH = 12

const noop = () => {}

/**
 * Combines a rectangle, a text and a diagonal/line
 * drawn from the source/origin (if any).
 * A block can have multiple origins (non fast-forward merges).
 *
 * A block can be added to a graph, removed, moved.
 */
export class Block {

  constructor ({ id, kind, label, branch, origins, position = 'right' }) {
    this.id = id
    this.label = label.length > MAX_LABEL_LENGTH ? `${label.substring(0, MAX_LABEL_LENGTH)}…` : label
    this.branch = branch
    this.origins = origins.filter((value) => value)
    this.container = branch.graph.container
    this.kind = kind
    this.x = branch.xNext()
    this.y = branch.y
    this.width = branch.graph.blockWidth
    this.height = branch.graph.blockHeight
    this.position = position // bottom | top | right | left
    this.classes = ['block', this.kind]
  }

  /**
   * Draw block into container
   * @param  {Function} options.callback function to call after drawing
   * @return {SVG element} created SVG block
   */
  draw (callback = noop) {
    const selector = this.remove()

    this.block = this.container.selectAll(`#${selector}`)
      .data([this])
      .enter()
      .append('g')
      .attr('id', selector)
      .attr('class', this.classes.join(' '))
      .attr('transform', `translate(${this.x},${this.y})`)

    // Set shape/rectangle
    this.block.append('rect')
      .attr({
        height: this.height,
        width: this.width,
        ry: CORNER_RADIUS,
        rx: CORNER_RADIUS
      })

    // Add text
    this.block.append('text')
      .text(this.label)
      .attr('x', this.width / 2)
      // FIXME : manage vertical alignment -- there should be a vertical equivalent of
      // text-anchor that would let us vert-center the origin, making this `this.height / 2`
      // instead.  We're likely baseline-aligned right now.
      .attr('y', this.height - 20)

    // Animate
    this.block.style('opacity', 0)
      .transition()
      .duration(1000)
      .style('opacity', 1)
      .each('end', callback)

    this.drawLinks()
  }

  /**
   * Draw diagonals/lines between block and its origins
   */
  drawLinks () {
    const selector = `diagonal-${this.id.replace(/(\/|\\)/, '-')}`

    // Remove existing links
    if (this.links) {
      this.links.remove()
    }

    const lnks = (this.origins || []).map((origin) => {
      // Manage positions
      let xSource = this.width / 2
      let ySource = this.height / 2

      if (this.position === 'right') {
        xSource = this.width
      } else if (this.position === 'left') {
        xSource = 0
      }

      if (this.position === 'bottom') {
        ySource = this.height
      } else if (this.position === 'top') {
        ySource = 0
      }

      const xTarget = ['top', 'bottom'].includes(this.position) ? this.width / 2 : 0
      let yTarget = this.height / 2
      if (this.position === 'bottom') {
        yTarget = 0
      } else if (this.position === 'top') {
        yTarget = this.height
      }

      return {
        source: {
          x: origin.x + xSource - this.x,
          y: origin.y + ySource - this.y
        },
        target: {
          x: xTarget,
          y: yTarget
        }
      }
    })

    this.links = (this.block || this.container).selectAll(`.${selector}`)
      .data(lnks)
      .enter().append('path')
      .attr('class', `link link-${this.kind} ${selector}`)
      .attr('d', diagonal)
    // Animate
    this.links.style('opacity', 0)
      .transition()
      .duration(1000)
      .style('opacity', 1)
  }

  /**
   * Add css class to block
   * @param {String} klass the class to add
   * return {Block} the current block
   */
  addClass (klass) {
    this.classes.push(klass)
    if (this.block) {
      this.block.attr('class', this.classes.join(' '))
    }
    return this
  }

  /**
   * Invert detach
   */
  attach () {
    this.classes = this.classes.filter((c) => c !== 'detached')
    if (this.block) {
      this.block.attr('class', this.classes.join(' '))
    }
  }

  /**
   * Set 'detach' class to block
   */
  detach () {
    this.classes = [...this.classes, 'detached']
    if (this.block) {
      this.block.attr('class', this.classes.join(' '))
    }
  }

  /**
   * Move block to new position
   */
  move () {
    this.block
      .transition()
      .duration(1000)
      .attr('transform', `translate(${this.x},${this.y})`)
    this.drawLinks()
    return this
  }

  /**
   * Refresh x, y positions
   * @param  {Commit} startCommit – commit where to start from
   * @return {Commit}             – return itself
   */
  refresh (startCommit) {
    this.x = this.branch.xNext(startCommit)
    this.y = this.branch.y
    this.width = this.branch.graph.blockWidth
    this.height = this.branch.graph.blockHeight
    if (startCommit) {
      this.origins = [startCommit]
    }
    return this
  }

  /**
   * Remove existing block with associated links
   * @return {String} the block selector
   */
  remove () {
    const selector = `block-${this.id.replace(/[/\\]/g, '-')}`
    this.container.selectAll(`#${selector}`).remove()
    // Remove existing links
    if (this.links) {
      this.links.remove()
    }
    return selector
  }
}

export class Commit extends Block {
  constructor ({ label, branch, origin, id = label, position = 'right' }) {
    super({
      ...arguments[0],
      kind: 'commit',
      origins: [origin]
    })
  }
}

export class MergeCommit extends Block {
  constructor ({ label, source, target }) {
    super({
      branch: source.branch,
      label,
      id: `${source.id}-${target.id}-merge`,
      kind: 'merge',
      origins: [source, target]
    })
    this.x = source.x > target.x ? source.branch.xNext() : target.branch.xNext()
  }
}

export class HeadTag extends Block {
  constructor ({ branch, origin, position = 'bottom' }) {
    super({
      branch,
      kind: 'head',
      label: 'HEAD',
      id: `head-${branch.id}`,
      origins: [origin],
      position
    })
    this.x = origin.x
    this.y = position === 'top' ? branch.yPrevious() : branch.yNext()
  }

  /**
   * Refresh x, y positions
   * @return {HeadTag} return itself
   */
  refresh (origin, tagPosition) {
    super.refresh(origin)
    if (origin && !tagPosition) {
      this.position = this.branch.tagPosition = origin.branch.tagPosition
    } else if (tagPosition) {
      this.position = tagPosition
    }
    this.x = this.origins[0].x
    this.y = this.position === 'top' ? this.branch.yPrevious() : this.branch.yNext(this.x)
    return this
  }
}

export class BranchTag extends Block {

  constructor ({ branch, origin, position = 'bottom' }) {
    super({
      branch,
      kind: 'branch',
      origins: [origin],
      id: `branch-${branch.id}`,
      label: branch.label,
      position
    })
    this.x = origin.x
    this.y = position === 'top' ? branch.yPrevious() : branch.yNext()
  }

  /**
   * Refresh x, y positions
   * @return {BranchTag} return itself
   */
  refresh (origin, tagPosition) {
    super.refresh(origin)
    if (origin && !tagPosition) {
      this.position = this.branch.tagPosition = origin.branch.tagPosition
    } else if (tagPosition) {
      this.position = tagPosition
    }
    this.x = this.origins[0].x
    this.y = this.position === 'top' ? (origin.branch || this.branch).yPrevious(this) : this.branch.yNext()
    return this
  }
}

export default Block
