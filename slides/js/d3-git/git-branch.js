import { Commit, HeadTag, BranchTag } from './git-block'

/**
 * A branch can have multiple commits (or none).
 * Its origin is the commit where it started.
 *
 * branchTag: commit where to put branch label
 */
export class Branch {

  constructor ({
    graph, origin, label,
    commits, detachedCommits,
    branchTag, headTag, startAt, tagPosition = 'bottom'
  }) {
    this.graph = graph
    this.label = label
    this.commits = []

    this.commits.last = function last () { return this[this.length - 1] }
    this.detachedCommits = detachedCommits
    this.tagPosition = tagPosition
    this.id = this.label.replace(/[().]/g, '')

    this.setOrigin(origin, startAt, !!(commits && commits.length > 0))
    this.addCommits(commits)
    this.setBranchTag(branchTag)
    this.setHeadTag(headTag)
  }

  /**
   * Add a new commit to commits list
   * @param {String} label – commit name/label
   */
  addCommit (label) {
    const id = `${this.id}-${this.commits.length}`
    const origin = this.commits.last() || this.startCommit
    const commit = new Commit({ id, label, origin, branch: this })
    this.commits.push(commit)
    return commit
  }

  /**
   * Create commits
   * @param {Array} commits – array of new commit names/labels
   */
  addCommits (commits = []) {
    commits.forEach((commit) => this.addCommit(commit))
  }

  /**
   * Draw branch: commits, tags, head, branch labels…
   */
  draw () {
    this.commits.forEach((commit) => commit.draw())
    this.branchTag.draw()
    if (this.headTag) {
      this.headTag.draw()
    }
  }

  /**
   * Find a specific commit from its label
   * @param  {String} label – commit name/label to look for
   * @return {Commit}       – the commit or null if not found
   */
  findCommit (label) {
    const commit = this.commits.find((commit) => commit.label === label)
    if (!commit) {
      throw new Error(`Cannot find commit with label "${label}" on branch "${this.label}"`)
    }
    return commit
  }

  /**
   * Move branch to target
   * @param  {Object} target – target commit with its branch name
   */
  move (target) {
    const origin = this.graph.findBranch(target.branch)
    if (!origin) {
      throw new Error(`Cannot find targeted branch <${target.branch}>`)
    }
    const startCommit = origin.findCommit(target.commit)
    if (!startCommit) {
      throw new Error(`Cannot find targeted commit <${target.commit}> on branch <${target.branch}>`)
    }
    this.setOrigin(origin, startCommit)
    this.commits[0].origin = startCommit
    this.commits.reduce((lastCommit, commit) => commit.refresh(lastCommit).move(), startCommit)

    this.branchTag.refresh().move()
    if (this.headTag) {
      this.headTag.refresh().move()
    }
  }

  /**
   * Remove commits from branch
   * Commit list has to ordered (First In Last Out)
   * @param  {Array} commits - commits to be detached
   */
  removeCommits (commits) {
    const commitLabels = this.commits.map(({ label }) => label)
    commits.forEach((commitLabel) => {
      const commit = this.findCommit(commitLabel)
      if (commit) {
        const index = commitLabels.indexOf(commitLabel)
        // Remove block from graph
        commit.remove()
        // Finaly remove commit from branch
        this.commits = this.commits.filter((currCommit) => currCommit.label !== commitLabel)
        this.commits.last = function last () { return this[this.length - 1] }
        // Then update branch blocks positions
        if (this.commits.length > index) {
          const startCommit = this.commits[index]
          this.commits.slice(index).reduce((lastCommit, commit) => commit.refresh(lastCommit).move(), startCommit)
        }
      }
    })
  }

  /**
   * Create branch tag / label
   * @param {[String]} branchTag – branch tag label
   */
  setBranchTag (branchTag) {
    let commit
    if (!branchTag) {
      commit = this.commits.length > 0 ? this.commits.last() : this.startCommit
    } else {
      commit = this.findCommit(branchTag)
    }
    if (commit) {
      this.branchTag = new BranchTag({ branch: this, origin: commit, position: this.tagPosition })
    }
  }

  /**
   * Create head tag
   * @param {[String]} headTag - HEAD tag label
   */
  setHeadTag (headTag) {
    if (!headTag) {
      return
    }

    const branchTag = this.branchTag || this.findCommit(headTag)
    if (branchTag) {
      this.headTag = new HeadTag({ branch: this, origin: branchTag, position: this.tagPosition })
    }
  }

  /**
   * Set branch start position
   * Store origin branch and origin commit
   * @param {Branch}  origin      origin branch
   * @param {Commit}  startAt     commit from where to start
   * @param {Boolean} withCommits does the branch have any attached commit?
   */
  setOrigin (origin, startAt, withCommits = true) {
    this.origin = origin
    this.startCommit = origin && startAt ? origin.findCommit(startAt) : null
    this.x = origin ? origin.xNext(this.startCommit) : 0
    if (!withCommits) {
      this.y = this.graph.y + (origin ? origin.y : 0)
    } else if (this.tagPosition === 'top') {
      // Free 2 blocks size height at top of branch if head
      // is used anywhere in the graph
      const gap = this.graph.blockHeight + this.graph.yGap
      this.y = this.graph.y + (origin ? origin.y : 0) + (this.graph.headless ? gap : 2 * gap)
    } else {
      this.y = this.graph.y + (origin ? (this.commits.length > 0 ? origin.yNext(this.x) : origin.y) : 0)
    }
  }

  /**
   * Get the next available abscissa / position
   * @param  {Commit} startCommit  commit where to start from
   * @return {Number}              the next abscissa/x position
   */
  xNext (startCommit = null) {
    if (this.commits.length === 0) {
      return this.x
    }

    const lastCommit = startCommit || this.commits.last()
    return lastCommit.x + lastCommit.width + this.graph.xGap
  }

  /**
   * Get the next available ordinate / position
   * @return {Number} – the next ordinate/y position
   */
  yNext (xAxis = null) {
    const gap = this.graph.blockHeight + this.graph.yGap
    const sameAxis = xAxis ? xAxis === this.branchTag.x : true
    if (this.branchTag && sameAxis && this.tagPosition !== 'top') {
      return this.branchTag.y + gap
    }

    if (this.commits.length === 0 || this.tagPosition === 'top') {
      return this.y
    }

    return this.commits.last().y + gap
  }

  /**
   * Get the previous ordinate / position
   * @return {Number} – the next ordinate/y position
   */
  yPrevious (source = null) {
    const gap = this.graph.blockHeight + this.graph.yGap
    const sameAxis = source ? (source.x === this.branchTag.x && source.position === this.branchTag.position) : true
    if (this.branchTag && sameAxis) {
      return this.branchTag.y - gap
    }

    if (this.commits.length === 0) {
      return this.y - 2 * gap
    }

    return this.commits.last().y - gap
  }
}

export default Branch
