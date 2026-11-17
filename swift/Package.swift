// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "PipMascot",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "PipMascot", targets: ["PipMascot"])
    ],
    targets: [
        .target(
            name: "PipMascot",
            resources: [.copy("Resources/pip-mobile.html")]
        )
    ]
)
