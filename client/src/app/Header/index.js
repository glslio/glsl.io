/** @jsx React.DOM */

var React = require("react");
var _ = require("lodash");
var GlslTransition = require("glsl-transition");
var Link = require("../../ui/Link");
var Logo = require("../../ui/GLSLioLogo");

var Header = React.createClass({
  propTypes: {
    user: React.PropTypes.string,
    screenName: React.PropTypes.string.isRequired,
    loading: React.PropTypes.bool.isRequired
  },
  render: function () {
    var screenName = this.props.screenName;
    var user = this.props.user;
    var webglsupported = GlslTransition.isSupported();

    var userPart = user ?
      <span className="github">
        <Link className="logout" href="/logout">logout</Link>
        <span> - </span>
        <Link className="profile" target="_blank" href={"/user/"+user}>
          <i className="fa fa-github"></i>&nbsp;
          {user}
        </Link>
      </span>
      :
      <Link className="github connect" href="/authenticate">
        Connect with <i className="fa fa-github"></i> Github
      </Link>
      ;

    var links = _.compact([
      { id: "home", href: "/", name: "Home" },
      { id: "gallery", href: "/gallery", name: "Gallery" },
      !this.props.user ? null : { id: "me", href: "/me", name: "My Transitions" },
      { id: "editor", href: "/transition/new", name: "Editor" },
      { id: "blog", href: "/blog", name: "Blog" }
    ]);

    var navs = _.map(links, function (nav) {
      return <Link key={nav.id} className={nav.id+(screenName===nav.id ? " current" : "")} href={nav.href}>{nav.name}</Link>;
    });

    return <header className="app-header">
      <span className={"loader "+(!this.props.loading ? "" : "loading")}>
        <i className="fa fa-circle-o-notch fa-spin"></i>
      </span>
      <Logo header={true} />
      <nav>
        {navs}
      </nav>
      {userPart}
      {webglsupported ? '' : <div className="notsupported">
        <i className="fa fa-warning"></i>
        &nbsp;
        <Link href="http://get.webgl.org/" target="_blank">
          WebGL is not supported by your current browser.
        </Link>
        &nbsp;
        <i className="fa fa-warning"></i>
      </div>}
    </header>;
  }
});

module.exports = Header;
