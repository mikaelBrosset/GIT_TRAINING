<img src="https://git-scm.com/images/logos/1color-darkbg@2x.png" alt="drawing" width="200"/>  

<h3>GIT TRAINING</h3>


#### Installation:
```
Linux:  
sudo apt-get update  
sudo apt-get install git

Mac:  
brew update
brew install git # or brew upgrade git if git was already there
```

#### Format to have a nice colored prompt with the branch name: 
```
export PS1="\[\033[36m\]\u\[\033[m\]@\[\033[32m\] \[\033[33;1m\]\w\[\033[m\] (\$(git branch 2>/dev/null | grep '^*' | colrm 1 2)) \$ "
(+ restart shell)

// mikael  ~/app/console (master) $ 
// name in green, curr dir in yellow, and branch in green
```

#### Some git-log alias examples in ~/.gitconfig file:  
```
[alias] 
lg1 = log --graph --abbrev-commit --decorate --format=format:'%C(bold blue)%h%C(reset) - %C(bold cyan)%aD%C(reset) %C(magenta)%an%C(reset) - %C(bold yellow)%d%C(reset)%C(white)%<(80,trunc)%s%C(reset) %C(dim white)' --all
lg2 = log --graph --abbrev-commit --decorate --format=format:'%C(bold blue)%h%C(reset) - %C(bold cyan)%aD%C(reset) %C(magenta)%an%C(reset) - %C(bold green)(%ar)%C(reset)%C(bold yellow)%d%C(reset)%n''%C(white)%s%C(reset) %C(dim white)' --all

git lg1 -10 // with 10 log entries
```

#### Useful links
https://git-school.github.io/visualizing-git/  
https://learngitbranching.js.org/  
https://delicious-insights.com/fr/tous-nos-articles-et-videos/ (and some javascript too)


