/** @jsx React.DOM */
var React = require("react");
var _ = require("lodash");
var Q = require("q");
var store = require("store");
var GlslTransitionValidator = require("glsl-transition-validator");
var validator = require("../../../../glslio/validator");

var validateTransition = require("../../../../glslio/validateTransition");
var BezierEasing = require("bezier-easing");
var Fps = require("../../../../ui/Fps");
var GlslContextualHelp = require("../../../../ui/GlslContextualHelp");
var VignetteConfig = require("../../../../ui/VignetteConfig");
var LicenseLabel = require("../../../../ui/LicenseLabel");
var TransitionPreview = require("../../../../ui/TransitionEditorPreview");
var ValidationIndicator = require("../../../../ui/ValidationIndicator");
var TransitionInfos = require("../../../../ui/TransitionInfos");
var TransitionActions = require("../../../../ui/TransitionEditorActions");
var TransitionComments = require("../../../../ui/TransitionComments");
var TransitionStar = require("../../../../ui/TransitionStar");
var TransitionEditor = require("../../../../ui/TransitionEditor");
var UniformsEditor = require("../../../../ui/UniformsEditor");
var Toolbar = require("../../../../ui/Toolbar");
var Button = require("../../../../ui/Button");
var Popup = require("../../../../ui/Popup");
var uniformValuesForUniforms = require("../../../../ui/UniformsEditor/uniformValuesForUniforms");

var PromisesMixin = require("../../../../core/mixins/Promises");
var router = require("../../../../core/router");
var model = require("../../../../app/models");
var textures = require("../../../../glslio/images/textures");

var ignoredUniforms = ["progress", "resolution", "from", "to"];

var unsupportedTypes = ["samplerCube"];

function keepCustomUniforms (uniforms) {
  return _.omit(uniforms, function (uniformType, uniformName) {
    return _.contains(ignoredUniforms, uniformName) || _.contains(unsupportedTypes, uniformType);
  });
}

function onLeavingAppIfUnsaved () {
  return "Are you sure you want to leave this page?\n\nUNSAVED CHANGES WILL BE LOST.";
}

function throwAgain (f, ctx) {
  return function (e) {
    return Q.fcall(_.bind(f, ctx||this, arguments)).thenReject(e);
  };
}

var EditorScreen = React.createClass({
  mixins: [ PromisesMixin ],
  propTypes: {
    env: React.PropTypes.object.isRequired,
    initialTransition: React.PropTypes.object.isRequired,
    images: React.PropTypes.array.isRequired,
    previewWidth: React.PropTypes.number.isRequired,
    previewHeight: React.PropTypes.number.isRequired
  },
  tabs: {
    uniforms: {
      title: "Params",
      icon: "fa-tasks",
      tabw: 2,
      render: function () {
        return <UniformsEditor initialUniformValues={this.state.rawTransition.uniforms} uniforms={this.state.uniformTypes} onUniformsChange={this.onUniformsChange} />;
      }
    },
    doc: {
      title: "Help",
      icon: "fa-info",
      tabw: 2,
      render: function () {
        return <GlslContextualHelp token={this.state.token} />;
      }
    },
    config: {
      title: "Config.",
      icon: "fa-cogs",
      tabw: 2,
      render: function () {
        return <VignetteConfig
          transitionDelay={this.state.transitionDelay}
          transitionDuration={this.state.transitionDuration}
          bezierEasing={this.state.bezierEasing}
          onDurationChange={this.onDurationChange}
          onDelayChange={this.onDelayChange}
          onBezierEasingChange={this.onBezierEasingChange}
          onResetConfig={this.onResetConfig}>
          This panel configures the way you see a Transition in the Editor.
          Configuration are persisted in localStorage of your browser.
        </VignetteConfig>;
      }
    },
    share: {
      title: "",
      icon: "fa-share-alt",
      tabw: 1,
      render: function () {
        var transition = this.state.transition;
        var saved = transition.id;
        var isRoot = transition.id === this.props.env.rootGist;
        if (!saved) {
          return <div className="extra">The transition need to be saved to be able to Share it.</div>;
        }
        else if (isRoot) {
          return <div className="extra">
            This transition is the Template transition.
            Create transitions by forking it and Share them!
          </div>;
        }
        else {
          var baseUrl = window.location.origin;
          var url = baseUrl+"/transition/"+transition.id;
          var text = "Checkout "+(transition.name.substring(0,30))+" by "+(transition.owner.substring(0,20))+" on @glslio";
          var embedUrl = url+"/embed";
          return <div>
            <dl>
              <dt>
                Share on:
              </dt>
              <dd className="share-sn">
                <Popup
                  name="Facebook"
                  href={"https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(url)}
                  width={600}
                  height={300}
                  scrollbars={true}>
                    <i className="fa fa-facebook"></i>
                </Popup>

                <Popup
                  name="Twitter"
                  href={"https://twitter.com/intent/tweet?url="+encodeURIComponent(url)+"&text="+encodeURIComponent(text)}
                  width={600}
                  height={300}
                  scrollbars={true}>
                    <i className="fa fa-twitter"></i>
                </Popup>

                <Popup
                  name="Google Plus"
                  href={"https://plus.google.com/u/0/share?url="+encodeURIComponent(url)}
                  width={480}
                  height={360}
                  scrollbars={true}>
                    <i className="fa fa-google-plus"></i>
                </Popup>
              </dd>

              <dt>
                Share this link:
              </dt>
              <dd>
                <input type="text" value={url} onClick={this.selectInputHandler} />
              </dd>

              <dt>
                Embed it:
                <Popup className="preview-link" href={embedUrl} width={512} height={384}>Preview</Popup>
              </dt>
              <dd>
              <textarea onClick={this.selectInputHandler}>
              {'<iframe width="512" height="384" src="'+embedUrl+'" frameborder="0"></iframe>'}
              </textarea>
              </dd>
            </dl>
          </div>;
        }
      }
    }
  },

  selectInputHandler: function (e) {
    e.target.select();
  },

  getInitialState: function () {
    var validation = validator.forGlsl(this.props.initialTransition.glsl);
    var uniformTypes = validation.compiles() ? validation.uniforms() : {};
    validation.destroy();
    var uniforms = textures.resolver.resolveSync(this.props.initialTransition.uniforms);
    var bezierEasing;
    try {
      bezierEasing = store.get("editor.bezierEasing");
      BezierEasing.apply(null, bezierEasing); // validate
    } catch (e) {
      bezierEasing = [0.25, 0.25, 0.75, 0.75];
    }
    var transitionDuration = store.get("editor.transitionDuration");
    if (!transitionDuration || isNaN(transitionDuration)) transitionDuration = 1500;
    var transitionDelay = store.get("editor.transitionDelay");
    if (isNaN(transitionDelay)) transitionDelay = 200;

    return {
      width: this.computeWidth(),
      height: this.computeHeight(),
      // FIXME: we should rename rawTransition to transition, and just keep the transformedUniforms
      rawTransition: this.props.initialTransition,
      transition: _.defaults({ uniforms: uniforms }, this.props.initialTransition),
      uniformTypes: keepCustomUniforms(uniformTypes),
      saveStatusMessage: null,
      saveStatus: null,
      token: null,
      tab: _.size(_.keys(uniforms))>0 ? "uniforms" : "doc",
      fps: null,
      bezierEasing: bezierEasing,
      transitionDuration: transitionDuration,
      transitionDelay: transitionDelay,
      validationErrors: []
    };
  },
  componentWillMount: function () {
    this.lastSavingTransition = this.lastSavedTransition = this.state.rawTransition;
    this.validator = new GlslTransitionValidator(this.props.images[0], this.props.images[1], 50, 30);
  },
  componentDidMount: function () {
    window.addEventListener("resize", this._onResize=_.bind(this.onResize, this), false);
    this.checkDetailedValidation = _.debounce(_.bind(this._checkDetailedValidation, this), 100);
    this.checkDetailedValidation(this.state.transition);
  },
  componentWillUnmount: function () {
    window.removeEventListener("resize", this._onResize);
    this.lastSavingTransition = this.lastSavedTransition = null;
    window.onbeforeunload = null;
    if (this.validator) {
      this.validator.destroy();
      this.validator = null;
    }
  },
  componentDidUpdate: function () {
    var onbeforeunload = this.hasUnsavingChanges() ? onLeavingAppIfUnsaved : null;
    if (onbeforeunload !== window.onbeforeunload)
      window.onbeforeunload = onbeforeunload;
  },

  _checkDetailedValidation: function (transition) {
    if (!this.isMounted()) return;
    var reasons = validateTransition(this.validator, transition);
    if (!_.isEqual(this.state.validationErrors, reasons)) {
      this.setState({
        validationErrors: reasons
      });
    }
  },

  // FIXME The current implementation is mutable but it is a quick workaround to not reload everything.
  starTransition: function (transition) {
    var self = this;
    return model.starTransition(transition.id)
      .get("stars")
      .then(function (count) {
        transition.stars = count;
        self.forceUpdate();
      });
  },
  unstarTransition: function (transition) {
    var self = this;
    return model.unstarTransition(transition.id)
      .get("stars")
      .then(function (count) {
        transition.stars = count;
        self.forceUpdate();
      });
  },

  render: function () {
    var hasUnsavingChanges = this.hasUnsavingChanges();
    var env = this.props.env;
    var transition = this.state.transition;
    var images = this.props.images;
    var previewWidth = this.props.previewWidth;
    var previewHeight = this.props.previewHeight;
    var width = this.state.width;
    var height = this.state.height;
    var star = env.user ? _.bind(this.starTransition, this, transition) : null;
    var unstar = env.user ? _.bind(this.unstarTransition, this, transition) : null;
    
    var editorWidth = width - 336;
    var editorHeight = height - 40;
    var isPublished = transition.name !== "TEMPLATE";

    var tab = this.tabs[this.state.tab];
    var tabContent = tab.render.apply(this, arguments);
    var sumW = _.reduce(_.pluck(this.tabs, "tabw"), function (sum, a) { return sum+a; });
    var tabs = _.map(this.tabs, function (t, tid) {
      var isCurrent = this.state.tab === tid;
      var tabwidth = (t.tabw*100/sumW)+"%";
      var f = _.bind(function () {
        return this.setStateQ({ tab: tid });
      }, this);
      var cls = ["tab"];
      if (isCurrent) cls.push("current");
      return <Button key={tid} className={cls.join(" ")} style={{width:tabwidth}} f={f} title={t.title}>
        <i className={ "fa "+t.icon }></i><span> {t.title}</span>
      </Button>;
    }, this);

    return <div className="editor-screen" style={{width:width,height:height}}>
      <Toolbar>
        <LicenseLabel />
        <TransitionActions saveDisabled={!hasUnsavingChanges} onSave={this.onSave} onPublish={this.onPublish} env={env} isPublished={isPublished} transition={transition} saveStatusMessage={this.state.saveStatusMessage} saveStatus={this.state.saveStatus} />
        <TransitionInfos env={env} isPublished={isPublished} transition={transition} />
      </Toolbar>
      <div className="main">
        <div className="view">
          <div className="leftPanel">
            <div>
              <Fps fps={this.state.fps} />
            </div>
            <div>
              <TransitionStar count={transition.stars} starred={_.contains(transition.stargazers, env.user)} star={star} unstar={unstar} />
            </div>
            <div>
              <TransitionComments count={transition.comments} href={transition.html_url} />
            </div>
          </div>
          <TransitionPreview transition={transition} images={images} width={previewWidth} height={previewHeight} onTransitionPerformed={this.onTransitionPerformed} transitionDelay={this.state.transitionDelay} transitionDuration={this.state.transitionDuration} transitionEasing={this.getEasing()}>
            <ValidationIndicator errors={this.state.validationErrors} />
          </TransitionPreview>

          <div className="tabs">{tabs}</div>
          <div className="tabContent">{tabContent}</div>
        </div>

        <TransitionEditor onCursorTokenChange={this.onCursorTokenChange} onChangeSuccess={this.onGlslChangeSuccess} onChangeFailure={this.onGlslChangeFailure} initialGlsl={transition.glsl} onSave={this.onSave} width={editorWidth} height={editorHeight} />
      </div>
    </div>;
  },
  getEasing: function () {
    return BezierEasing.apply(this, this.state.bezierEasing);
  },
  computeWidth: function () {
    return Math.max(600, window.innerWidth);
  },
  computeHeight: function () {
    return Math.max(550, window.innerHeight - 60);
  },
  setStateWithUniforms: function (state) {
    return textures.resolver.resolve(state.transition.uniforms)
      .then(_.bind(function (uniforms) {
        var transition = _.defaults({ uniforms: uniforms }, state.transition);
        return this.setStateQ(_.defaults({ transition: transition, rawTransition: state.transition }, state));
      }, this));
  },
  setSaveStatus: function (status, message) {
    return this.setStateQ({
      saveStatus: status,
      saveStatusMessage: message
    });
  },
  saveTransition: function () {
    var transition = _.cloneDeep(this.state.rawTransition);
    this.lastSavingTransition =  transition;
    return this.setSaveStatus("info", "Saving...")
      .thenResolve(transition)
      .then(_.bind(model.saveTransition, model))
      .then(_.bind(function () {
        this.lastSavedTransition = transition;
      }, this))
      .then(_.bind(this.setSaveStatus, this, "success", "Saved."))
      .fail(throwAgain(function () {
        this.lastSavingTransition = null;
        return this.setSaveStatus("error", "Save failed.");
      }, this));
  },
  createNewTransition: function () {
    var transition = _.cloneDeep(this.state.rawTransition);
    this.lastSavingTransition =  transition;
    return this.setSaveStatus("info", "Creating...")
      .thenResolve(transition)
      .then(_.bind(model.createNewTransition, model))
      .then(_.bind(function (r) {
        transition.id = r.id;
        return model.saveTransition(transition);
      }, this))
      .then(_.bind(function () {
        return this.setStateWithUniforms({ transition: transition });
      }, this))
      .then(_.bind(this.setSaveStatus, this, "success", "Created."))
      .then(function () {
        return router.route("/transition/"+transition.id);
      })
      .fail(throwAgain(function () {
        this.lastSavingTransition = null;
        return this.setSaveStatus("error", "Create failed.");
      }, this));
  },
  onDurationChange: function (duration) {
    store.set("editor.transitionDuration", duration);
    this.setState({
      transitionDuration: duration
    });
  },
  onDelayChange: function (delay) {
    store.set("editor.transitionDelay", delay);
    this.setState({
      transitionDelay: delay
    });
  },
  onBezierEasingChange: function (bezierEasing) {
    store.set("editor.bezierEasing", bezierEasing);
    this.setState({
      bezierEasing: bezierEasing
    });
  },
  onResetConfig: function () {
    store.remove("editor.transitionDuration");
    store.remove("editor.transitionDelay");
    store.remove("editor.bezierEasing");
    var initial = this.getInitialState();
    this.setState({
      transitionDuration: initial.transitionDuration,
      transitionDelay: initial.transitionDelay,
      bezierEasing: initial.bezierEasing
    });
  },
  onResize: function () {
    this.setState({
      width: this.computeWidth(),
      height: this.computeHeight()
    });
  },
  onSave: function () {
    if (this.hasUnsavingChanges()) {
      var isRootGist = this.props.env.rootGist === this.state.transition.id;
      if (isRootGist) {
        return this.createNewTransition();
      }
      else {
        return this.saveTransition();
      }
    }
  },
  onPublish: function () {
    // TODO making a proper UI for that. prompt() is the worse but easy solution
    var name = window.prompt("Please choose a transition name (alphanumeric only):");
    if (name.match(/^[a-zA-Z0-9_ ]+$/)) {
      return this.setStateWithUniforms({
          transition: _.defaults({ name: name }, this.state.rawTransition)
        })
        .then(_.bind(this.saveTransition, this))
        .then(_.bind(router.reload, router));
    }
    else {
      window.alert("Title must be alphanumeric.");
    }
  },  
  onCursorTokenChange: function (token) {
    this.setState({
      token: token
    });
  },
  onGlslChangeFailure: function (glsl) {
    this.checkDetailedValidation(_.defaults({
      glsl: glsl
    }, this.state.transition));
  },
  onGlslChangeSuccess: function (glsl, allUniformTypes) {
    var uniformTypes = keepCustomUniforms(allUniformTypes);
    var transition = _.defaults({
        glsl: glsl,
        uniforms: uniformValuesForUniforms(uniformTypes, this.state.rawTransition.uniforms)
      }, this.state.transition);
    this.checkDetailedValidation(transition);
    this.setStateWithUniforms({
      transition: transition,
      uniformTypes: uniformTypes
    });
  },
  onUniformsChange: function (uniforms) {
    this.setStateWithUniforms({
      transition: _.defaults({ uniforms: uniforms }, this.state.rawTransition)
    });
  },
  onTransitionPerformed: function (stats) {
    var fps = Math.round(1000 * stats.frames / stats.elapsedTime);
    this.setState({
      fps: fps
    });
  },
  hasUnsavingChanges: function () {
    return !_.isEqual(this.lastSavingTransition, this.state.rawTransition);
  },
  hasUnsavedChanges: function () {
    return !_.isEqual(this.lastSavedTransition, this.state.rawTransition);
  }
});

module.exports = EditorScreen;

