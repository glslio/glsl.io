/** @jsx React.DOM */

var React = require("react");
var ScreenContainer = React.createClass({
  propTypes: {
    name: React.PropTypes.string.isRequired
  },
  render: function () {
    return <div className={"screen-container screen-"+this.props.name}>{this.props.children}</div>;
  }
});
module.exports = ScreenContainer;
